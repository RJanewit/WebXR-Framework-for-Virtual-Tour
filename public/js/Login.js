document.getElementById('loginForm').addEventListener('submit', async function(event) {
    event.preventDefault(); 

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const messageEl = document.getElementById('message');

    messageEl.style.color = '#ccc';
    messageEl.textContent = 'กำลังตรวจสอบ...';

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }) 
        });

        const data = await response.json();

        // แก้ไขบรรทัด window.location.href ให้เป็นตามนี้ครับ
if (response.ok && data.success) {
            messageEl.style.color = '#4CAF50';
            messageEl.textContent = 'Login Successful! กำลังเข้าสู่ระบบ...';
            
            setTimeout(() => {
                // เปลี่ยนเป็นเส้นทางนี้ครับ
                window.location.href =  '/landing.html'; 
            }, 1000);
        }
 else {
            messageEl.style.color = '#F44336';
            messageEl.textContent = 'Invalid username or password.';
        }
    } catch (error) { // ตรงนี้แหละครับที่วงเล็บน่าจะพังไปเมื่อกี้
        messageEl.style.color = '#F44336';
        messageEl.textContent = 'Connection error.';
    }
});