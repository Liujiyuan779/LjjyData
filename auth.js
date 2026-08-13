(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.KaoYanAuth = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function randomHex(bytes) {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(function (b) {
      return b.toString(16).padStart(2, "0");
    }).join("");
  }

  async function sha256Hex(text) {
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest)).map(function (b) {
      return b.toString(16).padStart(2, "0");
    }).join("");
  }

  async function hashPassword(password, salt) {
    return await sha256Hex(salt + ":" + password);
  }

  async function registerUser(users, input) {
    const email = normalizeEmail(input.email);
    if (!EMAIL_RE.test(email)) {
      return { ok: false, error: "邮箱格式不正确" };
    }
    if (!input.password || String(input.password).length < 6) {
      return { ok: false, error: "密码至少 6 位" };
    }
    if (!/^\d{6}$/.test(String(input.secondaryPassword || ""))) {
      return { ok: false, error: "二级密码必须为 6 位数字" };
    }
    if (users.some(function (u) { return u.email === email; })) {
      return { ok: false, error: "该邮箱已注册" };
    }
    const salt = randomHex(16);
    const secondarySalt = randomHex(16);
    const passwordHash = await hashPassword(input.password, salt);
    const secondaryPasswordHash = await hashPassword(input.secondaryPassword, secondarySalt);
    const user = {
      id: "u_" + Date.now().toString(36) + "_" + randomHex(4),
      email: email,
      salt: salt,
      passwordHash: passwordHash,
      secondarySalt: secondarySalt,
      secondaryPasswordHash: secondaryPasswordHash,
      createdAt: new Date().toISOString()
    };
    users.push(user);
    return { ok: true, user: user };
  }

  async function loginUser(users, input) {
    const email = normalizeEmail(input.email);
    const user = users.find(function (u) {
      return u.email === email;
    });
    if (!user) {
      return { ok: false, error: "邮箱或密码错误" };
    }
    const passwordHash = await hashPassword(String(input.password || ""), user.salt);
    if (passwordHash !== user.passwordHash) {
      return { ok: false, error: "邮箱或密码错误" };
    }
    return { ok: true, user: user };
  }

  async function verifySecondaryPassword(users, input) {
    const email = normalizeEmail(input.email);
    const user = users.find(function (u) {
      return u.email === email;
    });
    if (!user) {
      return { ok: false, error: "该邮箱尚未注册" };
    }
    const secondaryPasswordHash = await hashPassword(String(input.secondaryPassword || ""), user.secondarySalt);
    if (secondaryPasswordHash !== user.secondaryPasswordHash) {
      return { ok: false, error: "二级密码错误" };
    }
    return { ok: true, user: user };
  }

  async function resetPassword(users, input) {
    const verified = await verifySecondaryPassword(users, {
      email: input.email,
      secondaryPassword: input.secondaryPassword
    });
    if (!verified.ok) {
      return verified;
    }
    if (!input.newPassword || String(input.newPassword).length < 6) {
      return { ok: false, error: "新密码至少 6 位" };
    }
    const user = verified.user;
    user.passwordHash = await hashPassword(input.newPassword, user.salt);
    return { ok: true, user: user };
  }

  function createSession(user) {
    return {
      userId: user.id,
      email: user.email,
      loginAt: new Date().toISOString()
    };
  }

  function isValidSession(session, users) {
    return !!session && users.some(function (u) {
      return u.id === session.userId;
    });
  }

  return {
    createSession: createSession,
    isValidSession: isValidSession,
    loginUser: loginUser,
    normalizeEmail: normalizeEmail,
    registerUser: registerUser,
    resetPassword: resetPassword,
    verifySecondaryPassword: verifySecondaryPassword
  };
});
