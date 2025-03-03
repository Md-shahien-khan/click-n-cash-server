require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
var jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
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

    // Create a new collection for notifications
    const notificationsCollection = client.db('clickAndCashDb').collection('notificationsCollection');




    // Create Payment Intent
    app.post('/create-payment-intent', async (req, res) => {
      try {
          const { email, amount } = req.body;
          if (!email || !amount) return res.status(400).send({ error: 'Invalid request' });
  
          const paymentIntent = await stripe.paymentIntents.create({
              amount: amount * 100, // Convert to cents
              currency: 'usd',
              payment_method_types: ['card'],
          });
  
          console.log('Payment Intent Created:', paymentIntent); // Log the payment intent
          res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
          console.error(error);
          res.status(500).send({ error: 'Payment Intent Error' });
      }
  });

    // Update User Coins after successful payment
    app.post('/update-coins', async (req, res) => {
      try {
          const { email, coins } = req.body;
          if (!email || coins === undefined) return res.status(400).send({ error: 'Invalid request' });
    
          const result = await userCollection.updateOne(
              { email },
              { $set: { coins } }
          );
    
          res.send({ success: true, message: 'Coins updated successfully', result });
      } catch (error) {
          console.error(error);
          res.status(500).send({ error: 'Failed to update coins' });
      }
    });




    // Create Notification Endpoint
    app.post('/notifications', async (req, res) => {
      const { user_email, message, type } = req.body;

      try {
        const notification = {
          user_email,
          message,
          type,
          status: 'unread',
          timestamp: new Date(),
        };

        const result = await notificationsCollection.insertOne(notification);
        res.status(201).send({ success: true, message: 'Notification created.', data: result });
      } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).send({ success: false, message: 'Internal server error.' });
      }
    });

    // Fetch Notifications for a User
    app.get('/notifications/:email', async (req, res) => {
      const email = req.params.email;

      try {
        const query = { user_email: email };
        const notifications = await notificationsCollection.find(query).toArray();
        res.status(200).send({ success: true, data: notifications });
      } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).send({ success: false, message: 'Internal server error.' });
      }
    });

    // Mark Notification as Read
    app.patch('/notifications/:id', async (req, res) => {
      const id = req.params.id;

      try {
        const result = await notificationsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: 'read' } }
        );

        if (result.modifiedCount > 0) {
          res.status(200).send({ success: true, message: 'Notification marked as read.' });
        } else {
          res.status(404).send({ success: false, message: 'Notification not found.' });
        }
      } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).send({ success: false, message: 'Internal server error.' });
      }
    });


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

    // payment intent
    app.post('/create-payment-intent', async(req, res) =>{
      const {price} = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, 'amount inside the intent');

      const paymentIntent = await stripe.paymentIntents.create({
        amount : amount,
        currency : 'usd',
        payment_method_types : ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
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






// Worker Submits Work
app.post('/submissions', async (req, res) => {
  const body = req.body;

  try {
    const result = await submissionsCollection.insertOne(body);

    // Create a notification for the buyer
    const notification = {
      user_email: body.buyer_email,
      message: `A worker has submitted work for your task: ${body.task_title}.`,
      type: 'submission',
    };

    await notificationsCollection.insertOne(notification);

    res.status(201).send({ success: true, data: result });
  } catch (error) {
    console.error('Error submitting work:', error);
    res.status(500).send({ success: false, message: 'Internal server error.' });
  }
});

// Buyer Accepts Work
app.patch('/acceptTask', async (req, res) => {
  const { previousId, worker_email, workersCoin, buyer_email } = req.body;

  try {
    // Update submission status to 'approved'
    const updateSubmission = await submissionsCollection.updateOne(
      { _id: new ObjectId(previousId) },
      { $set: { status: 'approved' } }
    );

    // Deduct coins from the buyer and add coins to the worker
    await userCollection.updateOne(
      { email: buyer_email },
      { $inc: { coins: -parseInt(workersCoin) } }
    );

    await userCollection.updateOne(
      { email: worker_email },
      { $inc: { coins: parseInt(workersCoin) } }
    );

    // Create a notification for the worker
    const notification = {
      user_email: worker_email,
      message: `Your submission has been accepted. You have received ${workersCoin} coins.`,
      type: 'accept',
    };

    await notificationsCollection.insertOne(notification);

    res.status(200).send({ success: true, message: 'Task accepted and coins transferred.' });
  } catch (error) {
    console.error('Error accepting task:', error);
    res.status(500).send({ success: false, message: 'Internal server error.' });
  }
});

// Buyer Rejects Work
app.patch('/rejectTask', async (req, res) => {
  const { taskId, worker_email } = req.body;

  try {
    // Update submission status to 'rejected'
    const updateSubmission = await submissionsCollection.updateOne(
      { _id: new ObjectId(taskId) },
      { $set: { status: 'rejected' } }
    );

    // Create a notification for the worker
    const notification = {
      user_email: worker_email,
      message: 'Your submission has been rejected.',
      type: 'reject',
    };

    await notificationsCollection.insertOne(notification);

    res.status(200).send({ success: true, message: 'Task rejected.' });
  } catch (error) {
    console.error('Error rejecting task:', error);
    res.status(500).send({ success: false, message: 'Internal server error.' });
  }
});









  // Accept Task Endpoint
  // app.patch('/acceptTask', async (req, res) => {
  //   const { previousId, worker_email, workersCoin, buyer_email } = req.body;
  
  //   try {
  //     // Fetch the buyer's current coins
  //     const buyer = await userCollection.findOne({ email: buyer_email });
  //     if (!buyer) {
  //       return res.status(404).send({ success: false, message: 'Buyer not found.' });
  //     }
  
  //     // // Check if the buyer has enough coins
  //     // if (buyer.coins < workersCoin) {
  //     //   return res.status(400).send({ success: false, message: 'Buyer does not have enough coins.' });
  //     // }
  
  //     // Update submission status to 'approved'
  //     const updateSubmission = await submissionsCollection.updateOne(
  //       { _id: new ObjectId(previousId) },
  //       { $set: { status: 'approved' } }
  //     );
  
  //     // Deduct coins from the buyer
  //     const updateBuyerCoins = await userCollection.updateOne(
  //       { email: buyer_email },
  //       { $inc: { coins: -parseInt(workersCoin) } }
  //     );

  //     console.log(updateBuyerCoins);
      
  
  //     // Add coins to the worker
  //     const updateWorkerCoins = await userCollection.updateOne(
  //       { email: worker_email },
  //       { $inc: { coins: parseInt(workersCoin) } }
  //     );
  
  //     if (
  //       updateSubmission.modifiedCount > 0 &&
  //       updateBuyerCoins.modifiedCount > 0 &&
  //       updateWorkerCoins.modifiedCount > 0
  //     ) {
  //       res.send({ success: true, message: 'Task accepted, coins transferred, and buyer coins updated.' });
  //     } else {
  //       res.status(400).send({ success: false, message: 'Failed to update task or coins.' });
  //     }
  //   } catch (error) {
  //     console.error('Error accepting task:', error);
  //     res.status(500).send({ success: false, message: 'Internal server error.' });
  //   }
  // });

  // // Reject Task Endpoint
  // app.patch('/rejectTask', async (req, res) => {
  //   const { taskId } = req.body;

  //   try {
  //     // Update submission status to 'rejected'
  //     const updateSubmission = await submissionsCollection.updateOne(
  //       { _id: new ObjectId(taskId) },
  //       { $set: { status: 'rejected' } }
  //     );

  //     if (updateSubmission.modifiedCount > 0) {
  //       res.send({ success: true, message: 'Task rejected.' });
  //     } else {
  //       res.status(400).send({ success: false, message: 'Failed to reject task.' });
  //     }
  //   } catch (error) {
  //     console.error('Error rejecting task:', error);
  //     res.status(500).send({ success: false, message: 'Internal server error.' });
  //   }
  // });




























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




  // Worker pending task
  app.get('/task/:email', async(req, res)=>{
    const email = req.params.email;
    const collectTask = submissionsCollection.find(email);
    res.send(collectTask);
  })
  


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

  // submit tasks post part

  app.post('/submissions', async (req, res) => {
    const body = req.body;
    // const submission = {
    //   task_id,
    //   task_title,
    //   payable_amount,
    //   worker_email,
    //   submission_details,
    //   worker_name,
    //   buyer_email,
    //   current_date,
    //   status
    // };
    const result = await submissionsCollection.insertOne(body);
    res.send(result);
  });
  // get all worker submission works
  app.get('/buyersSubmissions/:email', async(req, res) =>{
    const email = req.params.email;
    const query = {buyer_email : email}
    console.log(email, query);
    const result = await submissionsCollection.find(query).toArray();
    res.send(result);
  });
  // get submission from particular email person
  app.get('/allSubmissions/:email', async (req, res) => {
    const worker_email = req.params.email; // Correctly extracting email from params
    const query = { worker_email: worker_email }; // Filtering submissions based on worker's email

    try {
        const result = await submissionsCollection.find(query).toArray();
        res.send(result);
    } catch (error) {
        console.error("Error fetching submissions:", error);
        res.status(500).send({ message: "Internal Server Error" });
    }
});


  // accepting tasks
  app.patch('/acceptTask', async (req, res) => {
    try {
      const { previousId, worker_email, workersCoin } = req.body;
  
      if (!previousId || !worker_email || !workersCoin) {
        return res.status(400).send({ success: false, message: "Missing required fields" });
      }
  
      const updateSubmission = await submissionsCollection.updateOne(
        { _id: new ObjectId(previousId) },
        { $set: { status: 'approved' } }
      );
  
      const updateCoins = await userCollection.updateOne(
        { email: worker_email },
        { $inc: { coins: parseInt(workersCoin) } }
      );
  
      if (updateSubmission.modifiedCount > 0 && updateCoins.modifiedCount > 0) {
        res.send({ success: true, message: "Task accepted and coins transferred." });
      } else {
        res.status(400).send({ success: false, message: "Task update or coin transfer failed." });
      }
    } catch (error) {
      res.status(500).send({ success: false, message: "Server error", error: error.message });
    }
  });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  };


}
run().catch(console.dir);


app.get('/', (req, res) =>{
    res.send('click server is coming');
});

app.listen(port, () =>{
    console.log(`click and cash server is running on port ${port}`);
});






