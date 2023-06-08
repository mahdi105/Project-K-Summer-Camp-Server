const express = require('express');
const app = express();
const cors = require('cors');
require("dotenv").config();
const port = process.env.PORT || 5000;

// Middleware 
app.use(cors());
app.use(express.json());// Request body parser

// // Enable CORS == Solve the proble 'Browser stop the fetch request or unable to fetch
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// Home API
app.get('/', (req, res) => {
    res.send('Wellcome to Summer Camp Server');
})

// Port
app.listen(port, () => {
    console.log(`The server is running on the port: ${port}`);
})