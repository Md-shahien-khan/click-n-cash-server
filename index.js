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


    // get user by email
    app.get('/users/:email', async(req, res) =>{
      const email = req.params.email;
      // if(email !== req.decoded.email){
      //   return res.status(403).send({message : 'Forbidden Access'})
      // }
      const query = {email : email};
      const result = await userCollection.findOne(query);
      res.send(result);
    });

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
    // Create a new collection for submissions
    const submissionsCollection = client.db('clickAndCashDb').collection('submissionsCollection');

    // get Tasks
    app.get('/allTasks', async(req, res) =>{
      const result = await tasksCollection.find().toArray();
      res.send(result);
    });

    app.get('/allTasks/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await tasksCollection.findOne(query);
      res.send(result)
    });



    // get all tasks from email
    app.get('/tasks/:email', async(req, res) =>{
      const email = req.params.email;
      const query = {email : email}
      const result = await tasksCollection.find(query).toArray();
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



    // update user role
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



    
    // post task 
    app.post('/tasks', async (req, res) => {
      const taskDetails = req.body;  // The task data from the frontend
      const { required_workers, payable_amount, email } = taskDetails;

      // Fetch user data (including coins) using the provided email
      const user = await userCollection.findOne({ email: email });

      if (!user) {
          return res.status(404).send({ message: 'User not found' });
      }

      const totalPayableAmount = required_workers * payable_amount;

      // Check if the user has enough coins
      if (user.coins < totalPayableAmount) {
          return res.status(400).send({
              message: 'Not enough coins. Please purchase more coins.'
          });
      }

      // Save the task to the task collection
      try {
          const result = await tasksCollection.insertOne(taskDetails);

          // If the task was successfully saved, update the user's coins
          const updatedCoins = user.coins - totalPayableAmount;
          
          // Update user coins in the user collection
          await userCollection.updateOne(
              { email: email },
              { $set: { coins: updatedCoins } }
          );

          res.status(200).send({ message: 'Task added successfully and coins deducted.' });
      } catch (err) {
          console.error('Error adding task:', err);
          res.status(500).send({ message: 'Error adding task' });
      }
    });

  



  // update specific task
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
  

  // Delete Task from my task list
  app.delete('/tasks/:id', async (req, res) => {
    const { id } = req.params;
    // const body = req.body;
    // console.log('requested body', body);
    //   const email = req.query.email;
    //   const query = {email : email};
    //   const task = await tasksCollection.findOne(query);
    //   console.log('my tasks', task)
    //   const refillAmount = task.required_workers * task.payable_amount;
    //   const updateResult = await userCollection.updateOne(query, {
    //     $inc : {
    //       coins : refillAmount
    //     }
    //   })
      const result = await tasksCollection.deleteOne({ _id: new ObjectId(id) });
      // required_workers
      res.send(result);
  });




  // Delete Task by admin
  app.delete('/allTasks/:id', async (req, res) => {
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
    });







    
  // Assuming you already have this endpoint to update user data
  app.put('/users/:id', async (req, res) => {
    const userId = req.params.id;
    const { coins } = req.body;  // The updated coin value

    try {
      const updatedUser = await userCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { coins: coins } }
      );

      if (updatedUser.modifiedCount === 1) {
        res.status(200).send({ message: 'User coins updated successfully' });
      } else {
        res.status(404).send({ message: 'User not found' });
      }
    } catch (error) {
      console.error('Error updating user coins:', error);
      res.status(500).send({ message: 'Internal server error' });
    }
  });

  // Add this to your existing backend (app.js or routes.js file)
  app.post('/submissions', async (req, res) => {
    const { task_id, task_title, payable_amount, worker_email, submission_details, worker_name, buyer_name, buyer_email, current_date, status } = req.body;

    const submission = {
      task_id,
      task_title,
      payable_amount,
      worker_email,
      submission_details,
      worker_name,
      buyer_name,
      buyer_email,
      current_date,
      status
    };
    const result = await submissionsCollection.insertOne(submission);
    res.send(result);
  });

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






