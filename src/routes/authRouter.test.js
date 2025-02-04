const request = require('supertest');
const app = require('../service');

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  jest.setTimeout(60 * 1000 * 5); // 5 minutes
}

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
});

test('register', async () => {
  const user = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
  user.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const regRes = await request(app).post('/api/auth').send(user);
  expect(regRes.status).toBe(200);
});

test('register-no-password', async () => {
  const user = { name: 'pizza diner', email: 'reg@test.com'};
  user.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const regRes = await request(app).post('/api/auth').send(user);
  expect(regRes.status).toBe(400);
});

test('login', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const expectedUser = { ...testUser, roles: [{ role: 'diner' }] };
  delete expectedUser.password;
  expect(loginRes.body.user).toMatchObject(expectedUser);
});

test('logout', async () => {
  const logoutRes = await request(app).delete('/api/auth').set('Authorization', `Bearer ${testUserAuthToken}`);
  expect(logoutRes.status).toBe(200);
  expect(logoutRes.body).toMatchObject({ message: 'logout successful' });
});

test('logout-no-token', async () => {
  const logoutRes = await request(app).delete('/api/auth');
  expect(logoutRes.status).toBe(401);
});


  test('update', async () => {
    const newTestUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
    newTestUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send(testUser);
    const newTestUserAuthToken = registerRes.body.token;
    const newTestUserId = registerRes.body.user.id;
    expectValidJwt(newTestUserAuthToken);
  
    
  
    const updateRes = await request(app).put(`/api/auth/${newTestUserId}`).set('Authorization', `Bearer ${newTestUserAuthToken}`).send(newTestUser);
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.email).toBe(newTestUser.email);
    });

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}