const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
});

test('get menu', async () => {
    const getMenuRes = await request(app).get('/api/order/menu');
    expect(getMenuRes.status).toBe(200);    
});

test('add menu item', async () => {
    const admin = await createAdminUser();
    const loginRes = await request(app).put('/api/auth').send(admin);
    expect(loginRes.status).toBe(200);
    const adminAuthToken = loginRes.body.token;
    expectValidJwt(adminAuthToken);

    const addMenuReq = { title: "PB&J", description: "Not a pizza", image:"pizza9.png", price: 0.006 };

    const addMenuItemRes = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${adminAuthToken}`).send(addMenuReq);
    expect(addMenuItemRes.status).toBe(200);
});

test('get orders', async () => {
    const getOrdersRes = await request(app).get('/api/order').set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(getOrdersRes.status).toBe(200);
});

test('create order', async () => {
    const orderReq = { franchiseId: 1, storeId: 1, items: [{ menuId: 1, description: 'Veggie', price: 0.05 }] };
    const createOrderRes = await request(app).post('/api/order').set('Authorization', `Bearer ${testUserAuthToken}`).send(orderReq);
    expect(createOrderRes.status).toBe(200);
});


function expectValidJwt(potentialJwt) {
    expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
  }

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