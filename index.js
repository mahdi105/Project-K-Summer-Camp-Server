const express = require('express');
const app = express();
const cors = require('cors');
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');

// Middleware 
app.use(cors());
app.use(express.json());// Request body parser

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if(authorization){
        return res.status(401).send({erro:true, message: 'Unauthorized Access'})
    };
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.TOKEN_SECRET_KEY, (err, decoded) =>{
        if(err){
            return res.status(401).send({error: true, message: "Unauthorized Access"});
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

        // POST == a user while regirstratio or first time login using google, github, facebook ....
        app.post('/users', async(req, res) => {
            const user = req.body;
            const query = {email: user.email};
            const existingUser = await userCollection.findOne(query);
            if(existingUser){
                return res.send({exist: true, message:"User is already stored"});
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        })

        // GET == All instructors
        app.get('/instructors', async(req, res) => {
            const result = await instructorsCollection.find().toArray();
            res.send(result);
        });

        // status:"approved"
        // GET == All the approved classes
        app.get('/classes', async(req, res) => {
            const query = {status: "approved"};
            const result = await classesCollection.find(query).toArray();
            res.send(result)
        })

        // classid, name, student email
        app.post('/selectClass', verifyJWT, async(req, res) => {

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
    const token = jwt.sign(data, process.env.TOKEN_SECRET_KEY, {expiresIn: '1d'});
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