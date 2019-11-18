const Express = require("express");
const BodyParser = require("body-parser");
const CORS = require("cors");
const MongoDB = require("mongodb");
const MongoClient = require("mongodb").MongoClient;
const fs = require("fs");

const MASTER_ENCRYPTION_KEY_PATH = "../master-key.txt"; // The master key file which is required for decryption
const BASE64_KEY_ID = ""; // Base64 key in the namespace. Is the ObjectId for the document.
const KEY_VAULT_NAMESPACE = "encryption.__keyVault"; // The namespace where the Base64 key resides.

const server = Express();

server.use(BodyParser.json());
server.use(BodyParser.urlencoded({ extended: true }));
server.use(CORS());

const mongoClient = new MongoClient(
    "<ATLAS_URI_HERE>",
    {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        autoEncryption: {
            keyVaultNamespace: KEY_VAULT_NAMESPACE,
            kmsProviders: {
                local: {
                    key: fs.readFileSync(MASTER_ENCRYPTION_KEY_PATH),
                }
            },
            schemaMap: {
                "fle.people": {
                    "bsonType": "object",
                    "encryptMetadata": {
                        "keyId": [new MongoDB.Binary(Buffer.from(BASE64_KEY_ID, "base64"), 4)]
                    },
                    "properties": {
                        "firstname": { "bsonType": "string" },
                        "lastname": { "bsonType": "string" },
                        "email": {
                            "encrypt": {
                                "bsonType": "string",
                                "algorithm": "AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic",
                                //"keyId": [new MongoDB.Binary(Buffer.from(BASE64_KEY_ID, "base64"), 4)]
                            }
                        }
                    }
                }
            },
            extraOptions: {
                mongocryptdSpawnPath: "/usr/local/bin/mongocryptd",
            },
        }
    }
);
var database, collection;

/*
 * Take a request payload and insert it into the database. The payload should match the schema 
 * that was previously defined. Encryption happens automatically.
 */
server.post("/person", async (request, response, next) => {
    let result = await collection.insertOne(request.body);
    response.send(result);
});

/*
 * Return all documents from the collection. The encrypted fields are automatically decrypted before
 * they are returned to the client.
 */
server.get("/people", async (request, response, next) => {
    let people = await collection.find({}).toArray();
    response.send(people);
});

/*
 * Accept an email within a request and use it to filter for documents. The email is an encrypted field
 * that is used as the filter. The response includes decrypted fields.
 */
server.get("/person/email/:email", async (request, response, next) => {
    let person = await collection.findOne({ "email": request.params.email });
    response.send(person);
});

/*
 * Accept a document id and a payload. The first document found will be updated based on the content 
 * in the payload. Any fields defined in the schema for encryption will be automatically encrypted.
 */
server.put("/person/:id", async (request, response, next) => {
    let result = await collection.updateOne(
        {
            "_id": MongoDB.ObjectID(request.params.id)
        },
        {
            "$set": request.body
        }
    );
    response.send(result);
});

/*
 * Delete a document based on a document id passed by the client.
 */
server.delete("/person/:id", async (request, response, next) => {
    let result = await collection.deleteOne({ "_id": MongoDB.ObjectID(request.params.id) });
    response.send(result);
});

/*
 * Connect to the MongoDB cluster and obtain a reference to the database handle as well
 * as the collection handle. Then start serving the application for requests.
 */
const listener = server.listen(3000, async () => {
    try {
        await mongoClient.connect();
        database = mongoClient.db("fle");
        collection = database.collection("people");
        console.log("Connected to the database!")
        console.log(`Listening at :${listener.address().port}...`); 
    } catch (error) {
        console.error(error);
    }
});