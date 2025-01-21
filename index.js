require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
var jwt = require('jsonwebtoken');
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

    // verify admin after the verifyToken
    const verifyAdmin = async(req, res, next) =>{
      const email = req.decoded.email;
      const query = {email : email};
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if(!isAdmin){
        return res.status(403).send({message : 'Forbidden Access'})
      }
      next();
    }    


    // jwt related api
    app.post('/jwt', async(req, res) =>{
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn : '1h'});
      res.send({ token });
    });

    app.get('/users/admin/:email', async(req, res) =>{
      const email = req.params.email;
      // if(email !== req.decoded.email){
      //   return res.status(403).send({message : 'Forbidden Access'})
      // }
      const query = {email : email};
      const user = await userCollection.findOne(query);
      let admin = false;
      if(user){
        admin = user?.role === "admin";
      }
      res.send({admin});
    })

    // middle ware
    const verifyToken = (req, res, next) =>{
      console.log('inside verify token', req.headers.authorization);
      if(!req.headers.authorization){
        return res.status(401).send({message : 'Unauthorized Access'});
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) =>{
        if(err){
          return res.status(401).send({message : 'Unauthorized Access'})
        }
        req.decoded = decoded;
        next();
      })
    }



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
      console.log(req.headers);
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



    
    // app.get('/users/role/:email', async (req, res) => {
    //   const email = req.params.email
    //   console.log(email)
    //   const result = await userCollection.findOne({ email })
    //   console.log({result})
    //   res.send(result)
    //   })

        


    app.post('/tasks', async (req, res) => {
      const newTask = req.body;  // The task data including the image URL
      console.log("Inserting task:", newTask); 
      
      try {
          const result = await tasksCollection.insertOne(newTask); // Insert the task into the database
          res.send({ message: "Task added successfully", result });
      } catch (err) {
          console.error(err);
          res.status(500).send({ message: "Failed to add task" });
      }
  });
  


  // // Update Task
  // app.put('/tasks/:id', async (req, res) => {
  //   const { id } = req.params;
  //   const updatedTask = req.body;

  //   try {
  //     const result = await tasksCollection.updateOne(
  //       { _id: new ObjectId(id) },
  //       { $set: updatedTask }
  //     );

  //     if (result.modifiedCount === 1) {
  //       res.status(200).send({ message: 'Task updated successfully' });
  //     } else {
  //       res.status(400).send({ message: 'No changes made to the task' });
  //     }
  //   } catch (error) {
  //     console.error('Error updating task:', error);
  //     res.status(500).send({ message: 'Internal Server Error' });
  //   }
  // });
  app.put('/tasks/:id', async (req, res) => {
    const { id } = req.params;
    const updatedTask = req.body;
  
    // Remove the _id field from the updated task object before the update operation
    const { _id, ...taskData } = updatedTask;
  
    console.log('Updating task with ID:', id);
    console.log('Updated Task Data:', taskData);  // Only the fields that can be updated
  
    try {
      const result = await tasksCollection.updateOne(
        { _id: new ObjectId(id) },  // Ensure ObjectId is used for matching the document
        { $set: taskData }  // Only send the fields that can be updated
      );
  
      if (result.modifiedCount === 1) {
        res.status(200).send({ message: 'Task updated successfully' });
      } else {
        res.status(400).send({ message: 'No changes made to the task' });
      }
    } catch (error) {
      console.error('Error updating task:', error);
      res.status(500).send({ message: 'Internal Server Error', error: error.message });
    }
  });
  

  // Delete Task
  app.delete('/tasks/:id', async (req, res) => {
    const { id } = req.params;

    try {
      const result = await tasksCollection.deleteOne({ _id: new ObjectId(id) });

      if (result.deletedCount === 1) {
        res.status(200).send({ message: 'Task deleted successfully' });
      } else {
        res.status(404).send({ message: 'Task not found' });
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      res.status(500).send({ message: 'Internal Server Error' });
    }
  });




  // Update User's Coins
app.patch('/users/coins/:id', async (req, res) => {
  const { id } = req.params;
  const { coins } = req.body;  // Get the new coin amount

  try {
      // Find the user and update their coins
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
          $set: { coins }
      };

      const result = await userCollection.updateOne(filter, updatedDoc);

      if (result.modifiedCount > 0) {
          res.send({ message: 'User coins updated successfully' });
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






