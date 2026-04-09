(function () {
  var form = document.getElementById("registration-form");
  if (!form) return;

  var msg = document.getElementById("register-feedback");
  if (!msg) {
    msg = document.createElement("p");
    msg.id = "register-feedback";
    msg.className = "auth-switch";
    msg.style.marginTop = "1rem";
    msg.setAttribute("role", "alert");
    form.parentNode.insertBefore(msg, form.nextSibling);
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    msg.textContent = "";
    var pwd = document.getElementById("password").value;
    var conf = document.getElementById("confirm").value;
    if (pwd !== conf) {
      msg.textContent = "Passwords do not match.";
      return;
    }
    var body = {
      full_name: document.getElementById("name").value.trim(),
      email: document.getElementById("email").value.trim(),
      phone: (document.getElementById("phone") || {}).value || "",
      address: (document.getElementById("address") || {}).value || "",
      password: pwd,
    };
    try {
      await window.ocpmsFetchJson("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      });
      msg.style.color = "";
      msg.textContent = "Account created. Redirecting to login…";
      window.location.href = "login.html";
    } catch (err) {
      msg.style.color = "#f87171";
      msg.textContent = err.message || "Registration failed.";
    }
  });
})();
