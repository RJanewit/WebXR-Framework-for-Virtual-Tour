document.getElementById('loginForm').addEventListener('submit', async function(event) {
    event.preventDefault(); 

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const messageEl = document.getElementById('message');

    messageEl.style.color = '#ccc';
    messageEl.textContent = 'กำลังตรวจสอบ...';

    try {
        const response = await fetch('/api/users/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }) 
        });

        const data = await response.json();

        if (response.ok && data.token) {
            if (data.token) {
                localStorage.setItem('token', data.token);
            }

            messageEl.style.color = '#4CAF50';
            messageEl.textContent = 'Login Successful';
            
            setTimeout(() => {
                window.location.href = '/admin.html'; 
            }, 1000);
            
        } else {
            messageEl.style.color = '#F44336';
            messageEl.textContent = data.message || 'Invalid username or password.';
        }
    } catch (error) { 
        console.error("Login Request Failed:", error);
        messageEl.style.color = '#F44336';
        messageEl.textContent = 'Connection error.';
    }
});