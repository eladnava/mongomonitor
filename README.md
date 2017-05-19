# mongomonitor
[![npm version](https://badge.fury.io/js/mongomonitor.svg)](https://www.npmjs.com/package/mongomonitor)

A Node.js package that constantly monitors your [MongoDB replica set](https://eladnava.com/deploy-a-highly-available-mongodb-replica-set-on-aws/) to keep it healthy by checking the following:

* The overall health status of the replica set
* The minimum number of replica set members
* The existence of a primary replica set member and at least one secondary
* The health status of each replica set member, from the point of view of each member
* The number of members in the replica set is odd, not even (for election voting majority)
* The heartbeat timestamp between members is relatively low (indicating stable communication)
* The oplog date on secondary members is relatively recent (so that they don't fall too far behind on replication)
* The oplog length on each member is long enough to survive extended data member failures (for secondaries to catch up in case they were offline for a long period)
* The primary database disk utilization doesn't exceed a certain size (to avoid running out of disk space without notice)
* The `mongod` process on each member isn't consuming too much RAM (to avoid the OS from killing the process due to low memory)

When any of these conditions are not met, `mongomonitor` alerts you via e-mail or Slack so you can fix the issue ASAP.

### Email Preview

![Preview](https://raw.github.com/eladnava/mongomonitor/master/img/email-demo.png)

### Slack Preview

![Preview](https://raw.github.com/eladnava/mongomonitor/master/img/slack-demo.png)

## Usage

First, install the package using npm:

```shell
npm install -g mongomonitor
```

Then, create a file called `config.js` and paste the following inside it:

```js
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
    // SMTP configuration for sending alert e-mails (delete to disable)
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
    // Slack configuration for sending alert messages through webhook (delete to disable)
    slack: {
        channelUrl: 'https://hooks.slack.com/services/xxx/xxx/xxx',
        notifyMembers: ['john', 'sophia'] // enter slack user names here
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
```

Modify the configuration file according to your replica set, especially the following parameters:

* `database` - the name of your main database
* `members` - the hostnames of all of your replica set members
* `auth` - the database authentication username/password
* `smtp` (optional) - the SMTP e-mail configuration for sending alerts (using Gmail, AWS SES, etc)
* `slack` (optional) - the Slack webhook configuration for sending alert messages

---

Test the SMTP configuration by running:

```js
mongomonitor --test-email
```

Check the console for SMTP errors. If there are no SMTP errors, check your configured e-mail for the test e-mail.

Finally, run `mongomonitor` from the same directory as your `config.js` to actually start monitoring:

```js
mongomonitor
```

Observe the terminal output for any initial errors. If no errors are emitted, your MongoDB deployment is currently in good health. 

Leave the tool running on a remote server by executing the following command:

```js
mongomonitor &
```

## License

Apache 2.0
