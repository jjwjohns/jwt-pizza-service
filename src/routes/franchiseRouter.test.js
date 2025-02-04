const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');


if (process.env.VSCODE_INSPECTOR_OPTIONS) {
    jest.setTimeout(60 * 1000 * 5); // 5 minutes
  }

let authToken;
let admin;
  
beforeAll(async () => {
    admin = await createAdminUser(); 
    const loginRes = await request(app).put('/api/auth').send(admin);
    expect(loginRes.status).toBe(200);
    authToken = loginRes.body.token;
});

// afterAll(async () => {
//     const connection = await DB.getConnection();
//     await DB.query(connection, 'DELETE FROM store WHERE name LIKE ?', ['test%']);
//     await DB.query(connection, 'DELETE FROM franchise WHERE name LIKE ?', ['test%']);
//     await DB.query(connection, 'DELETE FROM user WHERE email = LIKE ?', ['%admin.com']);
// });

test('get franchises', async () => {
    const getRes = await request(app).get('/api/franchise');
    expect(getRes.status).toBe(200);
});

test('add franchise', async () => {
    const franName = 'test' + randomName();
    const franchiseReq = { name: franName, admins: [{ email: admin.email }] };
    const addFranchiseRes = await request(app).post(`/api/franchise`).set('Authorization', `Bearer ${authToken}`).send(franchiseReq);
    expect(addFranchiseRes.status).toBe(200);
    expect(addFranchiseRes.headers['content-type']).toMatch('application/json; charset=utf-8');
    expect(addFranchiseRes.body.name).toBe(franName);
});

test('getUserFranchises', async () => {
    const getFranchisesRes = await request(app).get(`/api/franchise/${admin.id}`).set('Authorization', `Bearer ${authToken}`);
    expect(getFranchisesRes.status).toBe(200);
    expect(getFranchisesRes.headers['content-type']).toMatch('application/json; charset=utf-8');
});

test('create franchise store', async () => {
    const franName = 'test' + randomName();
    const franchiseReq = { name: franName, admins: [{ email: admin.email }] };
    const addFranchiseRes = await request(app).post(`/api/franchise`).set('Authorization', `Bearer ${authToken}`).send(franchiseReq);
    expect(addFranchiseRes.status).toBe(200);
    expect(addFranchiseRes.headers['content-type']).toMatch('application/json; charset=utf-8');
    expect(addFranchiseRes.body.name).toBe(franName);

    const storeReq = { franchiseId: addFranchiseRes.body.id, name: 'test NEW YORK' };
    const addStoreRes = await request(app).post(`/api/franchise/${addFranchiseRes.body.id}/store`).set('Authorization', `Bearer ${authToken}`).send(storeReq);
    expect(addStoreRes.status).toBe(200);
    expect(addStoreRes.headers['content-type']).toMatch('application/json; charset=utf-8');
    expect(addStoreRes.body.name).toBe('test NEW YORK');
});

test('delete franchise', async () => {
    const franName = 'test' + randomName();
    const franchiseReq = { name: franName, admins: [{ email: admin.email }] };
    const addFranchiseRes = await request(app).post(`/api/franchise`).set('Authorization', `Bearer ${authToken}`).send(franchiseReq);
    expect(addFranchiseRes.status).toBe(200);
    expect(addFranchiseRes.headers['content-type']).toMatch('application/json; charset=utf-8');
    expect(addFranchiseRes.body.name).toBe(franName);

    const deleteFranchiseRes = await request(app).delete(`/api/franchise/${addFranchiseRes.body.id}`).set('Authorization', `Bearer ${authToken}`);
    expect(deleteFranchiseRes.status).toBe(200);
    expect(deleteFranchiseRes.headers['content-type']).toMatch('application/json; charset=utf-8');
    expect(deleteFranchiseRes.body.message).toBe('franchise deleted');

    const getRes = await request(app).get('/api/franchise');
    expect(getRes.body).not.toContainEqual(expect.objectContaining({ name: franName }))
});

test('delete franchise store', async () => {
    const franName = 'test' + randomName();
    const franchiseReq = { name: franName, admins: [{ email: admin.email }] };
    const addFranchiseRes = await request(app).post(`/api/franchise`).set('Authorization', `Bearer ${authToken}`).send(franchiseReq);
    expect(addFranchiseRes.status).toBe(200);
    expect(addFranchiseRes.headers['content-type']).toMatch('application/json; charset=utf-8');
    expect(addFranchiseRes.body.name).toBe(franName);

    const storeReq = { franchiseId: addFranchiseRes.body.id, name: 'test NEW YORK' };
    const addStoreRes = await request(app).post(`/api/franchise/${addFranchiseRes.body.id}/store`).set('Authorization', `Bearer ${authToken}`).send(storeReq);
    expect(addStoreRes.status).toBe(200);
    expect(addStoreRes.headers['content-type']).toMatch('application/json; charset=utf-8');
    expect(addStoreRes.body.name).toBe('test NEW YORK');

    const deleteStoreRes = await request(app).delete(`/api/franchise/${addFranchiseRes.body.id}/store/${addStoreRes.body.id}`).set('Authorization', `Bearer ${authToken}`);
    expect(deleteStoreRes.status).toBe(200);
    expect(deleteStoreRes.headers['content-type']).toMatch('application/json; charset=utf-8');
    expect(deleteStoreRes.body.message).toBe('store deleted');

    const getFranchisesRes = await request(app).get(`/api/franchise/${admin.id}`).set('Authorization', `Bearer ${authToken}`);
    expect(getFranchisesRes.body).not.toContainEqual(expect.objectContaining({ name: 'test NEW YORK' }));
});

async function createAdminUser() {
    let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
    user.name = randomName();
    user.email = user.name + '@admin.com';
  
    await DB.addUser(user);
    user.password = 'toomanysecrets';
  
    return user;
  }
  

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}


//async function createFranchise() {
//     const franName = randomName();
//     const franchiseReq = { name: franName, admins: [{ email: admin.email }] };
//     await request(app).post(`/api/franchise`).set('Authorization', `Bearer ${authToken}`).send(franchiseReq);
    
// }