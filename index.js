const express = require('express');
const app = express();
const cors = require('cors');
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

// Middleware 
app.use(cors());
app.use(express.json());// Request body parser

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'Unauthorized access' });
    }
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.TOKEN_SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'Unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}

// // Enable CORS == Solve the proble 'Browser stop the fetch request or unable to fetch
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.910rauf.mongodb.net/?retryWrites=true&w=majority`;

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
        client.connect();
        // Send a ping to confirm a successful connection
        client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        // Collection of Database
        // Users Database
        const userCollection = client.db('usersDb').collection('users');
        // Instructors Collection
        const instructorsCollection = client.db('instructorsDb').collection('instructors');
        // Classes Collection
        const classesCollection = client.db('classesDb').collection('classes');
        // Selected Classes Collection by Student
        const selectedClassesCollection = client.db('selectedClassesDb').collection('selectedClasses');
        // Payment Information Collection
        const paymentInfoCollection = client.db('paymentsDb').collection('payments');
        // Enrolled Classes Collection by user after successfull payment
        const enrolledClassCollection = client.db('enrolledClassesDb').collection('enrolledClasses');

        // Verify Admin Middleware (Securing Admin Specific API)
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            if (user && user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'Forbidden Access' });
            }
            next();
        }
        // Verify Instructor Middleware (Securing Instructors Specific API)
        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            if (user && user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'Forbidden Access' });
            }
            next();
        }
        // POST == a user while regirstratio or first time login using google, github, facebook ....
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ exist: true, message: "User is already stored" });
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        })

        app.get('/users', verifyJWT, verifyAdmin, async(req, res) => {
            const email = req.query.email;
            const decodedMail = req.decoded.email;
            if(email !== decodedMail){
                return res.status(403).send({error: true, message: 'Forbidden Access'});
            }
            const result = await userCollection.find().toArray();
            res.send(result);
        })

        // Make Admin
        app.patch('/users/admin_privilage/:id', verifyJWT, verifyAdmin, async(req, res) => {
            const id = req.params.id;
            const filter = {_id: new ObjectId(id)};
            const updateUser = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter,updateUser);
            res.send(result);
        })
        // Make Instructor
        app.patch('/users/instructor_privilage/:id', verifyJWT, verifyAdmin, async(req, res) => {
            const id = req.params.id;
            const filter = {_id: new ObjectId(id)};
            const updateUser = {
                $set: {
                    role: 'instructor'
                }
            }
            const result = await userCollection.updateOne(filter,updateUser);
            res.send(result);
        })

        // GET == All instructors
        app.get('/instructors', async (req, res) => {
            const result = await instructorsCollection.find().toArray();
            res.send(result);
        });

        // status:"approved"
        // GET == All the approved classes
        app.get('/classes', async (req, res) => {
            const query = { status: "approved" };
            const result = await classesCollection.find(query).toArray();
            res.send(result)
        })
        app.get('/allClasses', async (req, res) => {
            const result = await classesCollection.find().toArray();
            res.send(result);
        })

        // Get == A user and check role
        app.get('/user', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await userCollection.findOne(query);
            const isAdminOrInstructor = result && result?.role && result?.role === 'admin' || result?.role === 'instructor';
            res.send(isAdminOrInstructor);
        })

        //Save a class to database that student select from the UI Classes Page or From Popular Classes.
        app.post('/selectClass', verifyJWT, async (req, res) => {
            const data = req.body;
            const email = req.query.email;
            const decodedMail = req.decoded.email;
            if (email !== decodedMail) {
                return res.status(403).send({ error: true, message: 'Forbidden Access' });
            }
            const query = { courseId: data.courseId };
            const existCourse = await selectedClassesCollection.findOne(query);
            if (existCourse) {
                return res.send({ exist: true, message: 'Already selected' })
            }
            const result = await selectedClassesCollection.insertOne(data);
            res.send(result);
        })

        // Get== Selected classes by a users
        app.get('/selectedClasses', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedMail = req.decoded.email;
            if (email !== decodedMail) {
                return res.status(403).send({ error: true, message: 'Forbidden Access' });
            }
            const query = { email: email };
            const result = await selectedClassesCollection.find(query).toArray();
            res.send(result);
        })

        // DELETE = A selected class
        app.delete('/selectedClass/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const result = await selectedClassesCollection.deleteOne(filter);

            res.send(result);
        })

        // Create a Payment intents
        app.post('/create_payment_intent', verifyJWT, async (req, res) => {
            const { price } = req.body;

            if (price !== false) {
                if (price > 0) {
                    const paymentIntent = await stripe.paymentIntents.create({
                        amount: price * 100,
                        currency: "usd",
                        payment_method_types: ['card'],
                    })

                    res.send({
                        clientSecret: paymentIntent.client_secret,
                    });
                }

            }
        })

        // GET == A selected Class
        app.get('/selectedClass/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await classesCollection.findOne(query);
            res.send(result);
        })

        // POST == A payment as history in the history api
        app.post('/paymentInfo', verifyJWT, async (req, res) => {
            const paymentInfo = req.body;
            const result = await paymentInfoCollection.insertOne(paymentInfo);
            res.send(result);
        })

        // POST == An enrolled class to database
        app.post('/enrolledClass', verifyJWT, async (req, res) => {
            const { email, id } = req.body;
            const filter = { _id: new ObjectId(id) };
            const queryDelete = { courseId: id };
            const currentClass = await classesCollection.findOne(filter);
            // Remove a class from selected class selected by a user(student);
            const removeSelectedClass = await selectedClassesCollection.deleteOne(queryDelete);

            if (currentClass) {
                const availableSeats = currentClass && currentClass?.availableSeats > 0 && currentClass?.availableSeats;
                const numberOfStudents = currentClass && currentClass?.numberOfStudents;
                const updatedClass = {
                    $set: {
                        availableSeats: availableSeats - 1,
                        numberOfStudents: numberOfStudents + 1
                    }
                };
                // Update a class(student Count and available seats) after payment completed by a student
                const result = await classesCollection.updateOne(filter, updatedClass);
                const newClass = await classesCollection.findOne(filter);

                if (newClass) {
                    const enrolledClass = {
                        name: newClass.name,
                        image: newClass.image,
                        instructorName: newClass.instructorName,
                        email: newClass.email,
                        instructorImage: newClass.instructorImage,
                        availableSeats: newClass.availableSeats,
                        price: newClass.price,
                        status: newClass.status,
                        numberOfStudents: newClass.numberOfStudents,
                        studentEmail: email,
                    }
                    const enrolledTheClass = await enrolledClassCollection.insertOne(enrolledClass);
                    res.send(enrolledTheClass);
                }
            };
        })

        // GET == Enrolled Classes
        app.get('/enrolledClasses', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { studentEmail: email };
            const decodedMail = req.decoded.email;
            if (email !== decodedMail) {
                return res.status(403).send({ error: true, message: 'Forbidden Access' });
            }
            const result = await enrolledClassCollection.find(query).toArray();
            res.send(result)
        })

        app.get('/paymentsHistory', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedMail = req.decoded.email;
            if (email !== decodedMail) {
                return res.status(403).send({ error: true, message: "Forbidden Access" });
            }
            const query = { email: email };
            const result = await paymentInfoCollection.find(query).sort({ timestamp: -1 }).toArray();
            res.send(result);
        });

        // Admin Checking
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const decodedMail = req.decoded.email;
            if (email !== decodedMail) {
                return res.send({ admin: false })
            };
            const user = await userCollection.findOne(query);
            const result = { admin: user?.role == 'admin' };
            res.send(result);
        })

        // Instructor Checking API
        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const decodedMail = req.decoded.email;
            const query = { email: email };
            if (email !== decodedMail) {
                return res.send({ isInstructor: false });
            }
            const user = await userCollection.findOne(query);
            const result = { isInstructor: user?.role == 'instructor' };
            res.send(result);
        })

        // PATCh == class approval status change
        app.patch('/approveClass/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const upadateStatus = {
                $set: {
                    status: 'approved'
                }
            };
            const result = await classesCollection.updateOne(query, upadateStatus);
            res.send(result);
        })
        // PATCh == class approval status change
        app.patch('/denyClass/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const upadateStatus = {
                $set: {
                    status: 'denied'
                }
            };
            const result = await classesCollection.updateOne(query, upadateStatus);
            res.send(result);
        })

        // Feedback API
        app.patch('/classFeedback/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const feedback = req.body.feedback;
            const addFeedback = {
                $set: {
                    feedback: feedback
                }
            };
            const existFeedback = await classesCollection.findOne(filter);
            if (existFeedback && !existFeedback.feedback) {
                const result = await classesCollection.updateOne(filter, addFeedback);
                return res.send(result);
            }
        });

        // Get == all classes a instructor posted
        app.get('/myClasses', verifyJWT, verifyInstructor, async(req, res) => {
            const email = req.query.email;
            const decodedMail = req.decoded.email;
            if(email !== decodedMail){
                return res.status(403).send({error: true, message: 'Forbidden Access'});
            }
            const query = {email: email};
            const result = await classesCollection.find(query).toArray();
            res.send(result);
        })

        // POST == a new class
        app.post('/addClass', verifyJWT, verifyInstructor, async(req, res) => {
            const classInfo = req.body;
            const result = await classesCollection.insertOne(classInfo);
            res.send(result);
        })


    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


// Sign A JSON WEB TOKEN
app.post('/jwt', (req, res) => {
    const data = req.body;
    const token = jwt.sign(data, process.env.TOKEN_SECRET_KEY, { expiresIn: '1d' });
    res.send(token)
})

// Home API
app.get('/', (req, res) => {
    res.send('Wellcome to Summer Camp Server');
})
// Port
app.listen(port, () => {
    console.log(`The server is running on the port: ${port}`);
})