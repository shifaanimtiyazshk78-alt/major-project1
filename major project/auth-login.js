(function () {
  var form = document.getElementById("login-form");
  if (!form) return;

  var msg = document.getElementById("login-feedback");
  if (!msg) {
    msg = document.createElement("p");
    msg.id = "login-feedback";
    msg.className = "auth-switch";
    msg.style.marginTop = "1rem";
    msg.setAttribute("role", "alert");
    form.parentNode.insertBefore(msg, form.nextSibling);
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    msg.textContent = "";
    msg.style.color = "";
    var body = {
      email: document.getElementById("email").value.trim(),
      password: document.getElementById("password").value,
    };
    try {
      var data = await window.ocpmsFetchJson("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      });
      sessionStorage.setItem("ocpms_user_email", data.email);
      sessionStorage.setItem("ocpms_user_name", data.full_name);
      msg.textContent = "Welcome back. Redirecting…";
      window.location.href = "index.html";
    } catch (err) {
      msg.style.color = "#f87171";
      msg.textContent = err.message || "Login failed.";
    }
  });
})();
