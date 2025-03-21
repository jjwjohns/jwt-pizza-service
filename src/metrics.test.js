// A couple basic test generated by github copilot

const request = require('supertest');
const express = require('express');
const { requestTracker, authTracker, metrics } = require('./metrics');

// Mock the sendMetricToGrafana and sendHTTPMetricToGrafana functions
jest.mock('./metrics', () => {
    const originalModule = jest.requireActual('./metrics');
    return {
        ...originalModule,
        sendMetricToGrafana: jest.fn(),
        sendHTTPMetricToGrafana: jest.fn(),
    };
});

const app = express();
app.use(express.json());
app.use(requestTracker);

app.post('/api/order', (req, res) => {
    res.status(200).send({ message: 'Order placed' });
});

describe('Metrics Middleware', () => {
    beforeEach(() => {
        // Reset metrics before each test
        metrics.reset();
    });

    it('should track requests', async () => {
        await request(app).post('/api/order').send({ items: [{ price: 10 }] });
        expect(metrics.getRequestCount()).toBe(1);
    });

    it('should track authentication successes and failures', () => {
        authTracker(true);
        authTracker(false);
        expect(metrics.getAuthSuccessCount()).toBe(1);
        expect(metrics.getAuthFailureCount()).toBe(1);
    });
});

