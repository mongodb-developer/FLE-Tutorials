const MongoDB = require("mongodb");
const MongoClient = MongoDB.MongoClient;
const fs = require("fs");
const { ClientEncryption } = require('mongodb-client-encryption')(MongoDB);
const crypto = require("crypto");

const MASTER_ENCRYPTION_KEY_PATH = "./master-key.txt"; // Path for super secret master key
const KEY_VAULT_NAMESPACE = "encryption.__keyVault"; // Database and collection to store key id information

const mongoClient = new MongoClient(
    "<ATLAS_URI_HERE>",
    {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    }
);

(async () => {
    try {
        fs.writeFileSync(MASTER_ENCRYPTION_KEY_PATH, crypto.randomBytes(96));
        await mongoClient.connect();
        const encryption = new ClientEncryption(mongoClient, {
            keyVaultNamespace: KEY_VAULT_NAMESPACE,
            kmsProviders: {
                local: {
                    key: fs.readFileSync(MASTER_ENCRYPTION_KEY_PATH),
                }
            },
        });
        const key = await encryption.createDataKey("local");
        console.log('DataKeyId [base64]: ', key.toString("base64"));
    } catch (error) {
        console.error(error);
    } finally {
        mongoClient.close();
    }
})();