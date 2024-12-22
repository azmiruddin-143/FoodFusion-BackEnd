require('dotenv').config()
const express = require('express');
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const port = process.env.PORT || 5000
app.use(express.json())
app.use(cors())


// mongodb setup//

const uri = `mongodb+srv://${process.env.DB_FOODUSSER}:${process.env.DB_FOODPASS}@cluster0.phy8j.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        // backend start//


        const database = client.db("foodsDB");
        const foodsCollection = database.collection("foods");
        const foodPurchase = database.collection("purchase");

        // all product show //
        app.get("/foods", async (req, res) => {
            const result = await foodsCollection.find().toArray()
            res.send(result)
        })



        // foods post//
        app.post("/foods", async (req, res) => {
            const foodBody = req.body
            const result = await foodsCollection.insertOne(foodBody)
            res.send(result)
        })

        //Purchase post//
        app.post("/purchase", async (req, res) => {
            const purchaseBody = req.body
            const result = await foodPurchase.insertOne(purchaseBody);
            const filter = { _id: new ObjectId(purchaseBody.purchaseId) }
            const update = {
                    $inc: { PurchaseCount: 1 }
            }

            const updatePurchase = await foodsCollection.updateOne(filter, update);
            res.send(result)
        })



        // all product id //
        app.get("/singlefood/:id", async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) };
            const result = await foodsCollection.findOne(query);
            res.send(result)
        })
        app.get("/foodpurchase/:id", async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) };
            const result = await foodsCollection.findOne(query);
            res.send(result)
        })








        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send("FoodFusion Website ...")
})

app.listen(port, () => {
    console.log("Server Runnig", port);
})
