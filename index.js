require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());


// cluster connection

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5uoh0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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


    // user collection
    const userCollection = client.db('clickAndCashDb').collection('userCollection');
    // All Task collection
    const tasksCollection = client.db('clickAndCashDb').collection('tasksCollection');

    // get all tasks
    app.get('/tasks', async(req, res) =>{
      const result = await tasksCollection.find().toArray();
      res.send(result);
    });

    // get all users
    app.get('/users', async(req, res) =>{
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // delete 
    app.delete('/users/:id', async (req, res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // make admin
    // app.patch('/users/admin/:id', async(req, res) =>{
    //   const id = req.params.id;
    //   const filter = {_id: new ObjectId(id)};
    //   const updatedDoc = {
    //     $set : {
    //       role : 'admin'
    //     }
    //   }
    //   const result = await userCollection.updateOne(filter, updatedDoc);
    //   res.send(result);
    // })
    app.patch('/users/role/:id', async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;  // Get the new role from the request body
  
      // Ensure the role is one of the valid roles
      if (!['admin', 'buyer', 'worker'].includes(role)) {
          return res.status(400).send({ message: 'Invalid role' });
      }
  
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
          $set: { role }
      };
  
      try {
          const result = await userCollection.updateOne(filter, updatedDoc);
          if (result.modifiedCount > 0) {
              res.send({ message: 'User role updated successfully', modifiedCount: result.modifiedCount });
          } else {
              res.send({ message: 'No changes made' });
          }
      } catch (err) {
          console.error(err);
          res.status(500).send({ message: 'Internal server error' });
      }
    });



    // users related api
    app.post('/users', async(req, res) =>{
      const user = req.body;
      // insert email if user does not exists
      const query = {email : user.email}
      const existingUSer = await userCollection.findOne(query);
      if(existingUSer){
        return res.send({ message : 'User Already Exist', insertId : null})
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) =>{
    res.send('click server is coming');
});

app.listen(port, () =>{
    console.log(`click and cash server is running on port ${port}`);
});