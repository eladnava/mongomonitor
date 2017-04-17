module.exports = {
    // Main database to monitor
    database: 'app',
    // MongoDB replica set members
    members: [
        'db1.example.com',
        'db2.example.com',
        'arbiter1.example.com'
    ],
    // Database authentication
    auth: {
        username: 'user',
        password: 'a1b2c3d4f5',
        authSource: 'admin' // The database to authenticate against
    },
    // SMTP configuration for sending alert e-mails
    smtp: {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: 'username@gmail.com',
            pass: 'password'
        },
        address: 'username@gmail.com'
    },
    // Name of the preferred primary member (leave blank to disable checking)
    preferredPrimaryMember: '',
    // Number of seconds to wait in between health checks
    interval: 30,
    // Minimum number of members within your replica set
    minReplicaSetMembers: 3,
    // Maximum number of minutes for a member to be disconnected from another member
    maxHeartbeatThreshold: 3,
    // Maximum number of minutes for a secondary to lag behind while replicating from the primary's oplog
    maxReplicationDelay: 45,
    // Minimum number of minutes that each member's oplog must contain to survive a replica set data member failure
    minOplogLength: 60,
    // Maximum RAM memory (GB) each member's mongod process may occupy
    maxMongodMemory: 15,
    // Max database disk storage size (in MB) each member may utilize
    maxDatabaseSize: 12500
};