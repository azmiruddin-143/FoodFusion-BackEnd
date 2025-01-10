require('dotenv').config()
const express = require('express');
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const port = process.env.PORT || 5000
app.use(express.json())
app.use(cors({
    origin: 
    [
        'http://localhost:5173',
        'https://foodfusion-4eca3.web.app',
        'https://foodfusion-4eca3.firebaseapp.com',
    ],
    credentials: true
}))
app.use(cookieParser())


// mongodb setup//

const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token
    console.log(token);
    if (!token) {
        return res.status(401).send({ message: "unauthorized acccess" })
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: "unauthorized acccess" })
        }
        req.user = decoded;
        next();

    })
}

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
    


        const database = client.db("foodsDB");
        const foodsCollection = database.collection("foods");
        const foodPurchase = database.collection("purchase");

        //  auth related api//
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.JWT_SECRET, {
                expiresIn: '10h'
            })
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV=== 'production',
                sameSite: process.env.NODE_ENV=== 'production'? "none" : "strict",
            })
                .send({ success: true })
        })

        // token logout/// satart

        app.post('/logout', (req, res) => {

            res.clearCookie('token', {
                httpOnly: true,
                secure: false
            })
                .send({ success: true })
        })


        // all product show //
        app.get("/foods", async (req, res) => {
            const result = await foodsCollection.find().toArray()
            res.send(result)
        })

        app.get("/all-foods", async (req, res) => {
            // search filter setup//
            const search = req.query.search
            const filter = req.query.filter
            const sort = req.query.sort
            const query = { productName: { $regex: search, $options: 'i' } }
            if (filter) query.category = filter
            let options = {}
            if (sort) options = { sort: { purchaseCount: sort === "asc" ? 1 : -1 } }
            const result = await foodsCollection.find(query, options).toArray()
            res.send(result)
        })


        app.get('/topselling', async (req, res) => {
            try {
                const topSelling = await foodsCollection.aggregate([
                    { $sort: { purchaseCount: -1 } },
                    { $limit: 6 }
                ]).toArray();

                res.send(topSelling);
            } catch (error) {
                res.status(500).send('Error fetching top-selling products');
            }
        });


        // foods post//
        app.post("/foods", async (req, res) => {
            const foodBody = req.body
            const result = await foodsCollection.insertOne(foodBody)
            res.send(result)
        })
      



        app.post("/purchase", async (req, res) => {
            const purchaseBody = req.body;
            const { purchaseId, foodquantity } = purchaseBody;
            // Step 1: Find the product by ID
            const product = await foodsCollection.findOne({ _id: new ObjectId(purchaseId) });

            if (!product) {
                return res.status(404).send({ message: "Product not found" });
            }

            // Step 2: Check if sufficient quantity is available
            if (product.quantity < foodquantity) {
                return res.status(400).send({ message: "Not enough quantity available" });
            }

            // Step 3: Calculate new quantity
            const newQuantity = product.quantity - foodquantity;

            // Step 4: Update product quantity and increment purchase count
            const updateResult = await foodsCollection.updateOne(
                { _id: new ObjectId(purchaseId) },
                { $set: { quantity: newQuantity }, $inc: { purchaseCount: 1 } }
            );

            // Step 5: Insert purchase data into `foodPurchase` collection
            const purchaseResult = await foodPurchase.insertOne(purchaseBody);

            // Respond with success message and updated quantity
            res.send({
                message: "Purchase successful",
                updatedQuantity: newQuantity,
                purchaseData: purchaseResult,
            });
        });


        // ..............................................................

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


        // email quary //

        app.get("/foods/:email", verifyToken, async (req, res) => {
            const email = req.params.email
            const query = { sellerEmail: email };
            // cokise add
            if (req.user.email !== req.params.email) {
                return res.status(403).send({ message: "forbidden acces" });
            }
            // console.log(req.cookies);

            const result = await foodsCollection.find(query).toArray();
            res.send(result)
        })
        app.get("/purchase/:email", verifyToken, async (req, res) => {
            const email = req.params.email
            const query = { buyerEmail: email };
            if (req.user.email !== req.params.email) {
                return res.status(403).send({ message: "forbidden acces" });
            }
            const result = await foodPurchase.find(query).toArray();
            res.send(result)
        })


        // foods card update //

        app.put("/myfoods/:id", async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updateObject = req.body
            const updateDoc = {
                $set: {
                    productName: updateObject.productName,
                    image: updateObject.image,
                    description: updateObject.description,
                    quantity: updateObject.quantity,
                    category: updateObject.category,
                    foodorigin: updateObject.foodorigin,
                    price: updateObject.price,
                }
            }

            const result = await foodsCollection.updateOne(filter, updateDoc, options);
            res.send(result)

        })



        // dilet my foods item//

        app.delete("/foodpurchase/:id", async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) };
            const result = await foodPurchase.deleteOne(query);
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
    res.send("FoodFusion Website make ...")
})

app.listen(port, () => {
    console.log("Server Runnig", port);
})
