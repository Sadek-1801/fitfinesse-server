const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 9000;
const app = express();
require("dotenv").config();

// middle ware
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qv5d3vd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const userCollection = client.db("fitfinesse").collection("users");
    const classCollection = client.db("fitfinesse").collection("classes");
    const reviewsCollection = client.db("fitfinesse").collection("reviews");
    const forumCollection = client.db("fitfinesse").collection("forum");
    const subCollection = client.db("fitfinesse").collection("subscriber");
    const trainersCollection = client.db("fitfinesse").collection("trainers");
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection

    // trainers api
    app.post("/beATrainer", async (req, res) => {
      const body = req.body;
      const result = await trainersCollection.insertOne(body);
      res.send(result);
    });

    app.get("/trainers", async(req, res) =>{
      const result = await trainersCollection.find().toArray();
      res.send(result)
    })
    app.get("/featured-trainers", async(req, res) => {
      const result = await trainersCollection.aggregate([
        {
          $sort:{experience: -1}
        },
        {
          $limit: 3
        }
      ]).toArray()
      res.send(result)
    })

    // classes apli
    app.get("/classes", async (req, res) => {
      const result = await classCollection
        .aggregate([
          {
            $project: {
              _id: 0,
              title: 1,
            },
          },
        ])
        .toArray();
      res.send(result);
    });
    app.get("/featured-classes", async (req, res) => {
      // const bookingNumber = req.query.bookingNumber;
      // if (bookingNumber === 'dsc') {
      // // ToDo: try to sort in query
      // const query = {};
      // const sort = { numberOfBookings: -1 };
      // const result = await classCollection.find(query).sort(sort).toArray();
      const result = await classCollection
        .aggregate([{ $sort: { numberOfBookings: -1 } }, { $limit: 6 }])
        .toArray();
      res.send(result);
    });
    // subscriber collection
    app.post("/subscriber", async (req, res) => {
      const subscriber = req.body;
      const result = await subCollection.insertOne(subscriber);
      res.send(result);
    });

    // forum posts collection
    app.get("/forum-posts", async (req, res) => {
      const result = await forumCollection
        .aggregate([{ $sort: { date: -1 } }, { $limit: 4 }])
        .toArray();
      res.send(result);
    });

    // users api
    app.put("/user", async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      const isExist = await userCollection.findOne(query);
      if (isExist) {
        if (user.status === "pending") {
          const result = await userCollection.updateOne(query, {
            $set: { status: user?.status },
          });
          res.send(result);
        } else {
          return res.send(isExist);
        }
      }
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...user,
          time: Date.now(),
        },
      };
      const result = await userCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    // reviews api
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Fitfinesse server running");
});
app.listen(port, () => {
  console.log(`Fitfinesse Server is running on ${port}`);
});
