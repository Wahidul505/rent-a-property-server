const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(
    cors({
        origin: "*",
    })
);

// middleware for verifying token 
const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized User' });
    }
    else {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
            if (err) {
                return res.status(403).send({ message: 'Forbidden Access' });
            }
            else {
                req.decoded = decoded;
                next();
            }
        });
    }
};


const uri = `mongodb+srv://${process.env.DB_ADMIN}:${process.env.DB_PASS}@cluster0.srywn.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        client.connect();
        const userCollection = client.db('rent-property').collection('users');
        const propertyCollection = client.db('rent-property').collection('properties');
        const applicationCollection = client.db('rent-property').collection('bookings');

        // method for managing users by users theme selves 

        // to insert a new user
        app.post('/sign-up', async (req, res) => {
            const userInfo = req.body;
            const email = req.body.email;
            const existUser = await userCollection.findOne({ email: email });
            if (!existUser) {
                const result = userCollection.insertOne(userInfo);
                res.send({ status: true, result });
            }
            else {
                res.send({ status: false, error: 'This user is already exist' });
            }
        });

        // login with the existing account and generate a token after login 
        app.post('/login', async (req, res) => {
            const { email, password } = req.body;
            const user = await userCollection.findOne({ email: email, password: password });
            if (user) {
                const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
                res.send({ status: true, user, token });
            }
            else {
                res.send({ status: false, error: 'Authentication Error' });
            }
        })

        // to give property for rent from seller
        app.post('/property', async (req, res) => {
            const property = req.body;
            const result = await propertyCollection.insertOne(property);
            res.send(result);
        });

        // getting all properties 
        app.get('/property', async (req, res) => {
            const properties = await propertyCollection.find().toArray();
            res.send(properties);
        });

        // get a particular property 
        app.get('/property/:id', async (req, res) => {
            const id = req.params.id;
            const property = await propertyCollection.findOne({ _id: ObjectId(id) });
            res.send(property);
        });

        // to apply for a property 
        app.post('/applications', verifyJWT, async (req, res) => {
            const booking = req.body;
            const result = await applicationCollection.insertOne(booking);
            res.send(result);
        });

        // to update the status of the application after getting response from the seller  
        app.patch('/applications', async (req, res) => {
            const { id, status, email } = req.query;
            console.log(id, status, email);
            const application = await applicationCollection.findOne({ sellerEmail: email });
            if (application) {
                const filter = { _id: ObjectId(id) };
                const updateDoc = {
                    $set: {
                        status: status
                    }
                };
                const result = await applicationCollection.updateOne(filter, updateDoc);
                res.send({ success: true, result, status });
            }
            else {
                res.send({ success: false })
            }
        });

        // to get all the properties that a renter applied for 
        app.get('/my-rents/:email', async (req, res) => {
            const email = req.params.email;
            const bookings = await applicationCollection.find({ renterEmail: email }).toArray();
            res.send(bookings);
        });

        // to get all the properties that a seller posted for rent 
        app.get('/my-sales/:email', async (req, res) => {
            const email = req.params.email;
            const myProperties = await propertyCollection.find({ sellerEmail: email }).toArray();
            res.send(myProperties);
        });

        // to check the renter application is it applied or not 
        app.get('/isApplied', async (req, res) => {
            const id = req.query.id;
            const email = req.query.email;
            const booking = await applicationCollection.findOne({ propertyId: id, renterEmail: email });
            if (booking) {
                res.send({ success: true, status: booking.status });
            }
            else {
                res.send({ success: false });
            }
        });

        // to get all applications for a particular property
        app.get('/applications/:id', async (req, res) => {
            const id = req.params.id;
            const rentApplications = await applicationCollection.find({ propertyId: id }).toArray();
            res.send(rentApplications);
        });

    }
    finally { }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Started');
});

app.listen(port, () => console.log('Listening to Rent a Property', port));
