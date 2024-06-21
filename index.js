const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 9000;
const app = express();
require("dotenv").config();

// middle ware
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://fitfinesse.surge.sh",
    "https://fitfinesse-e1400.web.app",
    "https://fitfinesse.netlify.app",
  ],
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
    const feedbackCollection = client.db("fitfinesse").collection("feedback");
    const appliedTrainerCollection = client
      .db("fitfinesse")
      .collection("appliedTrainer");
    const trainerBookingCollection = client
      .db("fitfinesse")
      .collection("trainerBooking");
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_TOKEN, {
        expiresIn: "365d",
      });
      res.send({token})
    });

    // user-payment
    app.post("/trainer-booking", async (req, res) => {
      const body = req.body;
      const bookingWithTime = {
        ...body,
        time: new Date(),
      };
      const result = await trainerBookingCollection.insertOne(bookingWithTime);
      res.send(result);
    });
    app.get("/transaction", async (req, res) => {
      const result = await trainerBookingCollection
        .find()
        .sort({ time: -1 })
        .toArray();
      res.send(result);
    });
    // trainers api
    app.post("/beATrainer", async (req, res) => {
      const body = req.body;
      const query = { email: body?.email };
      try {
        const isExist = await appliedTrainerCollection.findOne(query);
        if (!isExist) {
          const result = await appliedTrainerCollection.insertOne(body);
          if (result.insertedId) {
            // Update the user's status in another collection
            const updateDocument = {
              $set: { status: "pending" },
            };
            const updateResult = await userCollection.updateOne(
              query,
              updateDocument
            );

            if (updateResult.modifiedCount > 0) {
              res.send({
                message:
                  "You've successfully applied! Wait for admin confirmation.",
              });
            } else {
              res
                .status(500)
                .send({ message: "Failed to update user status." });
            }
          } else {
            res.status(500).send({ message: "Failed to insert trainer data." });
          }
        } else {
          res.send({ message: "Wait for Admin Approval" });
        }
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ message: "An error occurred.", error: error.message });
      }
    });
    // update trainer
    app.patch("/update-trainer/:email", async (req, res) => {
      const body = req.body;
      const email = req.params.email;
      const query = { email };
      const updateDoc = {
        $set: {
          ...body,
        },
      };
      try {
        const result = await trainersCollection.updateOne(query, updateDoc);
        if (result.modifiedCount > 0) {
          res.send({ message: "You've successfully updated your profile." });
        } else {
          res.send({ message: "Please Try Again" });
        }
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ message: "An error occurred.", error: error.message });
      }
    });

    // applied trainer
    app.get("/appliedTrainers", async (req, res) => {
      const result = await appliedTrainerCollection.find().toArray();
      res.send(result);
    });
    app.get("/appTrainer/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await appliedTrainerCollection.findOne(query);
      res.send(result);
    });
    // delete a trainer after rejection
    app.delete("/rejected/:id", async (req, res) => {
      const { id } = req.params;
      const { feedback } = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid trainer ID" });
      }

      try {
        // Fetch the trainer's data
        const trainer = await appliedTrainerCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!trainer) {
          return res.status(404).send({ message: "Trainer not found" });
        }

        // Store feedback (optional)
        if (feedback) {
          await feedbackCollection.insertOne({
            trainerId: new ObjectId(id),
            email: trainer.email,
            feedback,
            date: new Date(),
          });
        }

        // Delete the applied trainer
        const result = await appliedTrainerCollection.deleteOne({
          _id: new ObjectId(id),
        });

        const updateResult = await userCollection.updateOne(
          { email: trainer.email },
          { $set: { role: "member", status: "rejected" } }
        );

        if (updateResult.modifiedCount === 1) {
          res.send({
            message:
              "Trainer rejected and removed from the applied list, user status updated",
          });
        } else {
          res.status(500).send({ message: "Failed to update user status" });
        }
      } catch (err) {
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // get rejected trainer
    app.get("/applications", async (req, res) => {
      const result = await feedbackCollection.find().toArray();
      res.send(result);
    });
    // all trainers
    app.get("/trainers", async (req, res) => {
      const result = await trainersCollection.find().toArray();
      res.send(result);
    });
    // single trainer by ID
    app.get("/trainer/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await trainersCollection.findOne(query);
      res.send(result);
    });
    // single trainer by email
    app.get("/trainer-email/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await trainersCollection.findOne(query);
      res.send(result);
    });
    app.get("/fetchTrainer/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await trainersCollection.findOne(query);
      res.send(result);
    });
    app.get("/featured-trainers", async (req, res) => {
      const result = await trainersCollection
        .aggregate([{ $sort: { experience: -1 } }, { $limit: 3 }])
        .toArray();
      res.send(result);
    });

    app.patch("/deleteTrainer/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };

      try {
        // Update the user's role to "member" and status to "verified" in the userCollection
        const updateResult = await userCollection.updateOne(query, {
          $set: { role: "member", status: "verified" },
        });

        // If the update was successful, proceed to delete from trainersCollection
        if (updateResult.modifiedCount > 0) {
          const deleteResult = await trainersCollection.deleteOne(query);

          if (deleteResult.deletedCount > 0) {
            res.status(200).send({ message: "Trainer deleted successfully" });
          } else {
            res
              .status(404)
              .send({ message: "Trainer not found in trainersCollection" });
          }
        } else {
          res
            .status(404)
            .send({ message: "User not found or already a member" });
        }
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ message: "An error occurred while processing your request" });
      }
    });

    // myTrainer
    app.get("/myTrainer/:email", async (req, res) => {
      const email = req.params.email;
      try {
        const result = await trainerBookingCollection
          .find({ userEmail: email })
          .toArray();
        res.send(result);
      } catch (err) {
        res
          .status(500)
          .send({ message: "An error occured while passing your reques" });
      }
    });

    // classes api
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
    app.get("/allClasses", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 6;
      const searchTerm = req.query.search || "";
      const skip = (page - 1) * limit;

      const query = {};
      if (searchTerm) {
        query.title = { $regex: searchTerm, $options: "i" };
      }

      const result = await classCollection
        .find(query)
        .skip(skip)
        .limit(limit)
        .toArray();
      const totalClasses = await classCollection.countDocuments(query);

      res.send({
        classes: result,
        totalPages: Math.ceil(totalClasses / limit),
        currentPage: page,
      });
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
    app.post("/addClass", async (req, res) => {
      const body = req.body;
      const result = await classCollection.insertOne(body);
      res.send(result);
    });
    // subscriber collection
    app.post("/subscriber", async (req, res) => {
      const subscriber = req.body;
      const result = await subCollection.insertOne(subscriber);
      res.send(result);
    });
    app.get("/subscribers", async (req, res) => {
      const result = await subCollection.find().toArray();
      res.send(result);
    });

    // delete slots
    app.delete("/slots/:slotName", async (req, res) => {
      const slotName = req.params.slotName;

      try {
        const result = await trainersCollection.updateOne(
          { "availableTime.slots.slotName": slotName },
          { $pull: { "availableTime.slots": { slotName } } }
        );

        if (result.modifiedCount > 0) {
          res.status(200).send({ message: "Slot deleted successfully" });
        } else {
          res.status(404).send({ message: "Slot not found" });
        }
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
    });

    // forum posts collection
    app.get("/forum-posts", async (req, res) => {
      const result = await forumCollection
        .aggregate([{ $sort: { date: -1 } }, { $limit: 4 }])
        .toArray();
      res.send(result);
    });
    app.post("/addForum", async (req, res) => {
      const body = req.body;
      const result = await forumCollection.insertOne(body);
      res.send(result);
    });
    app.get("/allForumPosts", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 6;
      const skip = (page - 1) * limit;

      const result = await forumCollection
        .find()
        .skip(skip)
        .limit(limit)
        .toArray();
      const total = await forumCollection.countDocuments();

      res.send({
        total,
        result,
      });
    });

    // Up-vote and down-vote endpoints
    app.post("/vote", async (req, res) => {
      const { postId, voteType } = req.body; // voteType: 'up' or 'down'
      const update =
        voteType === "up" ? { $inc: { votes: 1 } } : { $inc: { votes: -1 } };
      const result = await forumCollection.updateOne(
        { _id: new ObjectId(postId) },
        update
      );
      res.send(result);
    });

    // users api
    app.put("/user", async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      const isExist = await userCollection.findOne(query);
      if (isExist) {
        return res.send(isExist);
      }
      // todo: update name and photo
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
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });
    app.patch("/user/update/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      try {
        const user = await appliedTrainerCollection.findOne(query);

        if (user) {
          const deleteResult = await appliedTrainerCollection.deleteOne(query);

          if (deleteResult.deletedCount === 1) {
            const insertResult = await trainersCollection.insertOne(user);

            if (insertResult.insertedId) {
              // Update the user status in userCollection
              const updateDoc = {
                $set: { ...req.body, role: "trainer", status: "verified" },
              };
              const updateResult = await userCollection.updateOne(
                query,
                updateDoc
              );

              if (updateResult.modifiedCount > 0) {
                res.send({
                  message: "User has been verified and promoted to trainer.",
                });
              } else {
                res.send({
                  message: "Failed to update user status. Please try again.",
                });
              }
            } else {
              res.send({
                message:
                  "Failed to add user to trainers collection. Please try again.",
              });
            }
          } else {
            res.send({
              message:
                "Failed to remove user from applied trainers collection. Please try again.",
            });
          }
        } else {
          res.send({
            message: "User not found in applied trainers collection.",
          });
        }
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // reviews api
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    });
    app.post("/review", async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review);
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
