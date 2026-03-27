const express = require( 'express' );
const bodyParser = require( "body-parser" );
const cors = require( "cors" );
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const corsOptions = {
    origin: "*",
    credentials: true,
    optionSuccessStatus: 200,
};


const app = express();
const server = require( "http" ).createServer( app );
const swaggerDocument = YAML.load(path.join(__dirname, 'src/docs/openapi.yaml'));

// Middleware pour gérer les requêtes CORS
app.use( cors( corsOptions ) );

// Middleware pour parser le corps des requêtes
app.use( bodyParser.json() );
app.use( bodyParser.urlencoded( { extended: true } ) );

// Middleware pour parser le corps des requêtes en JSON
app.use( express.json() );

app.get( "/", ( req, res ) =>
{
    res.status( 200 ).json( { message: "Welcome to the backend API" } );
} );

// Gestion des routes
const router = require( './src/routes' );
app.use( router );
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use( function ( req, res )
{
    res.status( 404 ).json( { message: "Route not found" } );
} );


module.exports = server;