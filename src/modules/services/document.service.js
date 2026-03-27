const DocumentModel = require( '../models/document.model' );
const BatchModel = require( '../models/batch.model' );
const documentQueue = require( '../queues/document.queue' );
const { processDocumentJob } = require( './document.processor' );
const { queueSizeGauge } = require( '../../config/metrics' );


const findDocumentById = async ( documentId ) =>
{
    try
    {
        const document = await DocumentModel.findById( documentId );
        if ( !document )
        {
            return { status: 404, success: false, message: 'Document not found', data: null };
        }
        return { status: 200, success: true, message: 'Document found successfully', data: document };
    }  catch ( error )
    {
        console.error( 'Error finding document:', error );
        return { status: 500, success: false, message: 'Error finding document', error: error.message };
    }
};

const findBatchById = async ( batchId ) =>
{
    try
    {
        const batch = await BatchModel.findById( batchId ).populate( 'documents', 'status fileId error userId createdAt updatedAt' );
        if ( !batch )
        {
            return { status: 404, success: false, message: 'Batch not found', data: null };
        }

        const statusCounts = batch.documents.reduce( ( acc, doc ) =>
        {
            acc[ doc.status ] = ( acc[ doc.status ] || 0 ) + 1;
            return acc;
        }, {} );
        return {
            status: 200,
            success: true,
            message: 'Batch found successfully',
            data: batch,
            statusCounts
        };
    }
    catch ( error )
    {
        console.error( 'Error finding batch:', error );
        return { status: 500, success: false, message: 'Error finding batch', error: error.message };
    }
};

const createBatch = async ( userIds ) =>
{
    try
    {
        const batch = await BatchModel.create( { userIds, status: 'pending' } );

        await Promise.all( userIds.map( async ( userId ) =>
        {
            const doc = await DocumentModel.create( { userId, batchId: batch._id } );

            const payload = {
                documentId: doc._id.toString(),
                userId,
                batchId: batch._id.toString()
            };
            try
            {
                await documentQueue.add( payload, {
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 1000 }
                } );
            } catch ( queueError )
            {
                // Redis fallback: process in-memory when queue is unavailable.
                setImmediate( () =>
                {
                    processDocumentJob( { ...payload, source: 'memory-fallback' } ).catch( () => undefined );
                } );
            }

            batch.documents.push( doc._id );
        } ) );

        await batch.save();
        const counts = await documentQueue.getJobCounts().catch( () => ( { waiting: 0, active: 0 } ) );
        queueSizeGauge.set( ( counts.waiting || 0 ) + ( counts.active || 0 ) );
        return { status: 200, success: true, message: 'Batch created successfully', data: batch };
    } catch ( error )
    {
        console.error( 'Error creating batch:', error );
        return { status: 500, success: false, message: 'Error creating batch', error: error.message };
    }
};



module.exports = { findDocumentById, findBatchById, createBatch };