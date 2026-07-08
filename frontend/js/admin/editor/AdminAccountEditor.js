let editingAccountId = null;
let accountData = [];

// 🌟 โหลดข้อมูลจาก API และป้องกันบั๊ก _id ของ MongoDB
fetch("/api/users")
  .then((res) => res.json())
  .then((data) => {
    // แปลง _id ให้เป็น id เพื่อให้โค้ดทำงานได้ไม่บั๊ก
    accountData = data.map(acc => ({
        ...acc,
        id: acc._id || acc.id 
    }));
    renderAccounts();
  })
  .catch(err => console.error("โหลดข้อมูล Account ไม่สำเร็จ:", err));

window.renderAccounts = function () {
  const container = document.getElementById("account-list-container");
  if (!container) return;

  container.innerHTML = accountData
    .map((acc) => {
      if (acc.id === editingAccountId) {
        return `
            <div class="h-[130px] bg-theme-bg rounded-xl p-5 shadow-lg flex items-center gap-6 border-2 border-white relative">
                <div class="shrink-0 mx-4">
                    <i class="fa-solid fa-user text-[50px] text-primary"></i>                
                </div>

                <div class="flex-1 flex flex-col gap-2 text-primary font-bold text-[15px]">
                    <div class="flex items-center h-8">
                        <label class="w-28 shrink-0">Username</label>
                        <input type="text" id="edit-acc-name-${acc.id}" value="${acc.username}" class="flex-1 max-w-[250px] h-full border border-gray-400 px-2 bg-white outline-none focus:border-primary rounded">
                    </div>
                    <div class="flex items-center h-8">
                        <label class="w-28 shrink-0">Password</label>
                        <input type="password" id="edit-acc-pass-${acc.id}" value="" placeholder="${acc.isNew ? 'ตั้งรหัสผ่านใหม่' : 'เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน'}" class="flex-1 max-w-[250px] h-full border border-gray-400 px-2 bg-white outline-none focus:border-primary rounded placeholder:text-[12px] placeholder:font-normal">
                    </div>
                    <div class="flex items-center h-8">
                        <label class="w-28 shrink-0">Role</label>
                        <select id="edit-acc-role-${acc.id}" name="role" class="flex-1 max-w-[250px] h-full border border-gray-400 px-2 bg-white outline-none focus:border-primary rounded">
                            <option value="admin" ${acc.role === "admin" ? "selected" : ""}>Admin</option>
                            <option value="guest" ${acc.role === "guest" ? "selected" : ""}>Guest</option>
                        </select>
                    </div>
                    <span id="error-acc-${acc.id}" class="text-red-500 text-[12px] hidden absolute bottom-1 left-[140px]"></span>
                </div>
            
                <div class="shrink-0 flex flex-col gap-2">
                    <button onclick="saveAccount('${acc.id}')" class="w-9 h-9 bg-saved text-white rounded-full flex items-center justify-center hover:bg-green-600 shadow-sm cursor-pointer" title="Save">
                        <i class="fa-solid fa-check text-[18px]"></i>
                    </button>
                    <button onclick="cancelEditAccount('${acc.id}')" class="w-9 h-9 bg-danger text-white rounded-full flex items-center justify-center hover:bg-red-700 shadow-sm cursor-pointer" title="Cancel">
                        <i class="fa-solid fa-xmark text-[18px]"></i>
                    </button>
                </div>
            </div>`;
      } else {
        return `
            <div class="h-[130px] bg-theme-bg rounded-xl p-5 shadow-md flex items-center gap-6 border-2 border-transparent">
                <div class="shrink-0 mx-4">
                    <i class="fa-solid fa-user text-[50px] text-primary"></i>
                </div>
                
                <div class="flex-1 flex flex-col gap-2 text-primary font-bold text-[15px]">
                    <div class="flex items-center h-8"><span class="w-28 shrink-0">Username</span><span class="text-gray-800">${acc.username}</span></div>
                    <div class="flex items-center h-8"><span class="w-28 shrink-0">Password</span><span class="text-gray-800 text-lg tracking-widest mt-1">********</span></div>
                    <div class="flex items-center h-8"><span class="w-28 shrink-0">Role</span><span class="text-gray-800">${acc.role}</span></div>
                </div>
                
                <div class="shrink-0 flex flex-col gap-2">
                    <button onclick="editAccount('${acc.id}')" class="w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center hover:bg-blue-900 shadow-sm cursor-pointer" title="Edit">
                        <i class="fa-solid fa-pen-to-square text-[15px]"></i>
                    </button>
                    <button onclick="deleteAccount('${acc.id}')" class="w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm cursor-pointer" title="Delete">
                        <i class="fa-solid fa-trash-can text-[15px]"></i>
                    </button>
                </div>
            </div>`;
      }
    })
    .join("");
};

// 🌟 จับคู่ปุ่ม Add Account 
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btn-add-account")?.addEventListener("click", () => {
      if (editingAccountId !== null) return;
      const newId = "acc_" + Date.now();
      accountData.unshift({
        id: newId,
        username: "",
        password: "",
        role: "guest",
        isNew: true,
      });
      editingAccountId = newId;
      renderAccounts();
    });
});

window.editAccount = function (id) {
  if (editingAccountId !== null) return;
  editingAccountId = id;
  renderAccounts();
};

window.cancelEditAccount = function (id) {
  const accIndex = accountData.findIndex((a) => a.id === id);
  if (accountData[accIndex].isNew) {
    accountData.splice(accIndex, 1);
  }
  editingAccountId = null;
  renderAccounts();
};

window.deleteAccount = function (id) {
  if (confirm("Are you sure you want to delete this account?")) {
    accountData = accountData.filter((a) => a.id !== id);
    renderAccounts();
  }
};

window.saveAccount = function (id) {
  const inputNameEl = document.getElementById(`edit-acc-name-${id}`);
  const inputPassEl = document.getElementById(`edit-acc-pass-${id}`);
  const inputRoleEl = document.getElementById(`edit-acc-role-${id}`);

  const cleanName = inputNameEl.value.trim();
  const cleanPass = inputPassEl.value.trim();
  const roleValue = inputRoleEl.value;

  const payload = { username: cleanName, role: roleValue };
  if (cleanPass !== "") payload.password = cleanPass;

  const accIndex = accountData.findIndex((a) => a.id === id);
  const acc = accountData[accIndex];

  const showError = (msg) => {
    inputNameEl.classList.add("border-red-500", "bg-red-50");
    const errEl = document.getElementById(`error-acc-${id}`);
    if (errEl) {
      errEl.innerText = msg;
      errEl.classList.remove("hidden");
    }
    inputNameEl.focus();
  };

  if (cleanName === "") { showError("กรุณากรอก Username"); return; }
  if (acc.isNew && cleanPass === "") { showError("กรุณาตั้งรหัสผ่านใหม่"); inputPassEl.focus(); return; }
  if (accountData.some((a) => a.username.toLowerCase() === cleanName.toLowerCase() && a.id !== id)) { showError("Username นี้มีคนใช้แล้ว"); return; }

  if (acc.isNew) {
    fetch("/api/users/insert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(res => res.ok ? res.json() : res.json().then(d => { throw new Error(d.error) }))
      .then(data => {
        alert("สร้าง Account สำเร็จ!");
        accountData[accIndex] = { ...payload, id: data._id || data.id }; 
        editingAccountId = null;
        renderAccounts();
      }).catch(err => alert("Error: " + err.message));
  } else {
    fetch(`/api/users/update/${acc.username}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(res => res.ok ? res.json() : res.json().then(d => { throw new Error(d.error) }))
      .then(() => {
        alert("อัปเดต Account สำเร็จ!");
        acc.username = cleanName;
        acc.role = roleValue;
        delete acc.isNew;
        editingAccountId = null;
        renderAccounts();
      }).catch(err => alert("Error: " + err.message));
  }
};