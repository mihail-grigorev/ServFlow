import requests

BASE = 'http://127.0.0.1:8000'

# 1. Health
r = requests.get(f'{BASE}/api/health')
assert r.status_code == 200, f'Health failed: {r.status_code}'
print('1. Health check passed:', r.json())

# 2. Login dispatcher
r = requests.post(f'{BASE}/api/auth/login', json={'email': 'dispatcher@kofeservice.ru', 'password': 'password123'})
assert r.status_code == 200, f'Login failed: {r.status_code}'
token = r.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}
print('2. Dispatcher login passed, user:', r.json()['user']['full_name'])

# Ensure clean seed state before test assertions
requests.post(f'{BASE}/api/seed/reset', headers=headers)

# Get demo users dynamically
r_users = requests.get(f'{BASE}/api/auth/demo-users', headers=headers)
demo_users = r_users.json()
ivanov = next(u for u in demo_users if 'Иванов' in u['full_name'])

# 3. Equipment
r = requests.get(f'{BASE}/api/equipment', headers=headers)
assert len(r.json()) == 12, f'Expected 12 equipments, got {len(r.json())}'
print('3. Equipment list passed: 12 machines verified')

# 4. Spare parts
r = requests.get(f'{BASE}/api/parts', headers=headers)
assert len(r.json()) == 10, f'Expected 10 parts, got {len(r.json())}'
print('4. Spare parts list passed: 10 parts verified')

# 5. Threads
r = requests.get(f'{BASE}/api/threads', headers=headers)
threads_list = r.json()
assert len(threads_list) == 13, f'Expected 13 threads, got {len(threads_list)}'
print('5. Threads list passed: 13 client threads verified')

# Find thread for Ресторан «Пирс» (EQ12)
thread_10 = next(t for t in threads_list if 'Пирс' in t['client_name'])

# 6. AI Analysis on Thread for Ресторан «Пирс» (Warranty Rule П-9 + Inter-warehouse logistics Rule П-8)
r = requests.post(f'{BASE}/api/ai/analyze-thread/{thread_10["id"]}', headers=headers)
assert r.status_code == 200, f'AI failed: {r.status_code}'
ai_res = r.json()
assert ai_res['is_warranty'] == True, 'Thread should be warranty!'
print('6. AI Analysis on Thread 10 passed: Warranty confirmed (П-9), Parts suggested:', len(ai_res['recommended_parts']))

# 7. Create Service Order
order_payload = {
    'thread_id': thread_10['id'],
    'client_name': 'Ресторан «Пирс»',
    'equipment_code': 'EQ12',
    'address': 'Москва, Пресненская наб., 6',
    'model': 'C100',
    'serial_number': '133',
    'symptom': 'Слабый напор пара из парового крана',
    'client_assumption': 'Замечание шеф-бариста',
    'is_warranty': True,
    'warranty_reason': ai_res['warranty_reason'],
    'is_sales_transfer': False,
    'engineer_id': ivanov['id'],
    'reserved_parts': [{'code': 'S100', 'name': 'Ремкомплект парового крана', 'quantity': 1, 'source_city': 'Тула', 'transfer_required': True}]
}
r = requests.post(f'{BASE}/api/orders', json=order_payload, headers=headers)
assert r.status_code == 200, f'Create order failed: {r.status_code}'
order_data = r.json()
order_id = order_data['id']
print('7. Order creation passed:', order_data['order_number'], 'Reserved parts:', len(order_data['reserved_parts']))

# 8. Update Order Status
r = requests.patch(f'{BASE}/api/orders/{order_id}/status', json={'status': 'В пути'}, headers=headers)
assert r.json()['status'] == 'В пути'
print('8. Order status update passed: В пути')

# 9. Engineer Login & Inspection Report
r_eng = requests.post(f'{BASE}/api/auth/login', json={'email': ivanov['email'], 'password': 'password123'})
eng_token = r_eng.json()['access_token']
eng_headers = {'Authorization': f'Bearer {eng_token}'}
r = requests.post(f'{BASE}/api/orders/{order_id}/report', json={'inspection_report': 'Осмотр выполнен. Произведена замена уплотнителей крана (S100). Пар в норме.'}, headers=eng_headers)
assert r.json()['status'] == 'Выполнен'
print('9. Inspection report submission passed, status: Выполнен')

# 10. Simulate customer message
r = requests.post(f'{BASE}/api/threads/simulate', json={
    'client_name': 'Кафе «Ромашка»',
    'content': 'Купили с рук C200 №230, течёт вода',
    'channel': 'Звонок'
})
assert r.status_code == 200
sim_thread = r.json()
assert sim_thread['is_unregistered'] == True
print('10. Simulator passed: Rule П-2 recognized unregistered machine')

# 11. Root frontend check
r = requests.get(f'{BASE}/')
assert r.status_code == 200
assert 'КофеСервис Регион' in r.text
print('11. Frontend index.html served passed')

# 12. Logo check
r = requests.get(f'{BASE}/logo.png')
assert r.status_code == 200
assert r.headers['content-type'] == 'image/png'
print('12. Logo served passed: 200 image/png')

print('\nALL 12 INTEGRATION TESTS PASSED WITH 100% SUCCESS!')
