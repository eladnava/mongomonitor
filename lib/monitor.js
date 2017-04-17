var co = require('co');
var log = require('npmlog');
var mongodb = require('co-mongodb');
var logger = require('../util/logger');

function monitor(config) {
    // Make sure config passed in
    if (!config) {
        throw new Error('Please provide a valid config file to use mongomonitor.');
    }

    // Save it for later
    this.config = config;
}

monitor.prototype.runHealthChecks = function* () {
    // Log current operation
    log.info('mongomonitor', new Date(), 'Running health checks');

    // Traverse replica set members
    for (var host of this.config.members) {
        // Connection handle
        var db;

        try {
            // Attempt to connect to current member
            db = yield mongodb.client.connect(`mongodb://${this.config.auth.username}:${this.config.auth.password}@${host}/${this.config.database}?authSource=${this.config.auth.authSource}`);
        }
        catch (err) {
            // Log fatal error and continue to next member
            logger.notifyError(new Error(`Failed to connect to replica set member: ${host}.`, err), this.config);
            continue;
        }

        try {
            // Check that the member is healthy
            yield this.verifyMemberHealthy(db, host);

            // Check that disk space is not running out
            yield this.verifySufficientDiskSpace(db);

            // Make sure oplog length is long enough to survive a replica set data member failure
            yield this.verifySufficientOplogLength(db, host);
        }
        finally {
            // Close DB connection
            db.close();
        }
    }
};

monitor.prototype.verifyMemberHealthy = function* (db, host) {
    // Run 'rs.status()' on the node
    var rs = yield db.executeDbAdminCommand({ replSetGetStatus: 1 });

    // Problem with replica set?
    if (!rs.ok) {
        logger.notifyError(new Error(`Replica set status on host ${host} is not OK.`), this.config);
    }

    // Missing member(s)?
    if (rs.members.length < this.config.minReplicaSetMembers) {
        logger.notifyError(new Error(`Replica set configuration on host ${host} contains only ${rs.members.length} members (minimum: ${this.config.minReplicaSetMembers}).`), this.config);
    }

    // Even number of members?
    if (rs.members.length % 2 === 0) {
        logger.notifyError(new Error(`Replica set configuration on host ${host} contains an even number of members (${rs.members.length}) which will cause primary elections to fail.`), this.config);
    }

    // Verify at least one primary and secondary member exists
    var primary, secondary;

    // Traverse members
    for (var member of rs.members) {
        // Found primary?
        if (member.state == 1) {
            primary = member;
        }
        // Found secondary?
        else if (member.state === 2) {
            secondary = member;
        }

        // Unhealthy?
        if (!member.health) {
            logger.notifyError(new Error(`${member.name} reported an unhealthy status as seen from host ${host} (state: ${member.stateStr}).`), this.config);
        }

        // Verify that member is connected by checking its last heartbeat timestamp
        if (member.lastHeartbeat && member.lastHeartbeat.getTime() < new Date().getTime() - (1000 * 60 * this.config.maxHeartbeatThreshold)) {
            logger.notifyError(new Error(`${member.name} appears to be disconnected from host ${host} (last heartbeat: ${member.lastHeartbeat}).`), this.config);
        }

        // Secondary member (and not an arbiter)?
        if (member.syncingTo && member.state !== 7) {
            // Verify that oplog date is recent, otherwise server is falling behind on replication
            if (member.optimeDate.getTime() < new Date().getTime() - (1000 * 60 * this.config.maxReplicationDelay)) {
                logger.notifyError(new Error(`${member.name} (secondary) appears to be falling behind on replication (optime date: ${member.optimeDate}).`), this.config);
            }
        }
    }

    // Check for missing primary (this may occur temporarily during planned stepdown)
    if (!primary) {
        logger.notifyError(new Error(`Replica set contains no primary member as seen from host ${host}.`), this.config);
    }

    // Check for at least one secondary
    if (!secondary) {
        logger.notifyError(new Error(`Replica set contains no secondary member as seen from host ${host}.`), this.config);
    }

    // Check that the primary member is the one we intended
    if (this.config.preferredPrimaryMember && primary.name.indexOf(this.config.preferredPrimaryMember) === -1) {
        logger.notifyError(new Error(`Replica set primary member as seen from host ${host} is undesirable: ${primary.name}.`), this.config);
    }

    // Run 'db.serverStatus()' on the node
    var status = yield db.executeDbAdminCommand({ serverStatus: 1 });

    // MongoDB consuming up too much memory?
    if (status.mem.resident > this.config.maxMongodMemory * 1000) {
        logger.notifyError(new Error(`${host} is taking up too much memory (${status.mem.resident.toLocaleString()} mb).`), this.config);
    }
};

monitor.prototype.verifySufficientDiskSpace = function* (db) {
    // Get collection stats
    var stats = yield db.stats();

    // Get DB storage size in MB (from bytes)
    var storageSize = stats.storageSize / 1000 / 1000;

    // Check for an exceeding storage size
    if (storageSize > this.config.maxDatabaseSize) {
        logger.notifyError(new Error(`Database storage size ${storageSize} mb has exceeded ${this.config.maxDatabaseSize}.`), this.config);
    }
};

monitor.prototype.verifySufficientOplogLength = function* (db, host) {
    // Get DB member type to check if data member
    var memberType = yield db.command({ isMaster: 1 });

    // No replication happens on arbiters
    if (memberType.arbiterOnly) {
        return;
    }

    // Get "local" sibling DB and "oplog.rs" collection
    var collection = db.db('local').collection('oplog.rs');

    // Get oldest document in collection which indicates how far the oplog dates
    var cursor = collection.find({}, { sort: { $natural: 1 }, limit: 1 });

    // Convert cursor to array
    var data = yield mongodb.cursor.toArray(cursor);

    // Failed?
    if (data.length === 0) {
        return logger.notifyError(new Error(`Failed to retrieve oldest oplog timestamp for host ${host}.`), this.config);
    }

    // Get first (and only) document
    var oplog = data[0];

    // Get oldest oplog document timestamp
    var timestamp = oplog.ts.getHighBits();

    // Get current unix timestamp
    var nowTimestamp = Math.round(new Date().getTime() / 1000);

    // Calculate number of minutes the oplog length spans
    var lengthMinutes = Math.round((nowTimestamp - timestamp) / 60);

    // Check whether the oplog length is insufficient
    if (lengthMinutes < this.config.minOplogLength) {
        logger.notifyError(new Error(`Database oplog length for ${host} is only ${lengthMinutes.toLocaleString()} minutes long.`), this.config);
    }
};

monitor.prototype.startMonitoring = function () {
    // Run the task runner which calls itself recursively
    this.taskRunner();
};

monitor.prototype.taskRunner = function () {
    // Keep track of class instance
    var that = this;

    // Magical ES6 generator wrapper
    co(function* () {
        try {
            // Run the health check logic
            yield that.runHealthChecks(that.config);
        }
        catch (err) {
            // Notify admin of unknown exception
            logger.notifyError(err, that.config);
        }
        finally {
            // Schedule this task again in the future recursively
            setTimeout(that.taskRunner.bind(that), that.config.interval * 1000);
        }
    });
};

// Expose the class
module.exports = monitor;