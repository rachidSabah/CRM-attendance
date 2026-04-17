(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,10160,e=>{"use strict";function t(e){return(t="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}e.s(["default",()=>t])},11366,e=>{"use strict";function t(){try{let e=localStorage.getItem("attendance_brevo_config");if(e){let t=JSON.parse(e);return{apiKey:t.apiKey||"",senderEmail:t.senderEmail||""}}}catch{}return{apiKey:"",senderEmail:""}}function a(e){localStorage.setItem("attendance_brevo_config",JSON.stringify(e))}function n(){return t()}async function i(e){try{let a=t(),n=await fetch("/api/send-email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...e,...a.apiKey?{apiKey:a.apiKey}:{},...a.senderEmail?{senderEmail:a.senderEmail}:{}})});return await n.json()}catch(e){return console.error("[email] Failed to send:",e),{success:!1,error:"Network error — could not reach email service"}}}async function o(e){let{to:t,toName:a}=e;if(!t||!t.includes("@"))return{success:!1,error:"Invalid recipient email"};let n="fr"===(e.language||"en");return i({to:t,toName:a,subject:e.ticketNumber?n?`[CRM] T\xe2che assign\xe9e: ${e.taskTitle} (${e.ticketNumber})`:`[CRM] Task Assigned: ${e.taskTitle} (${e.ticketNumber})`:n?`[CRM] T\xe2che assign\xe9e: ${e.taskTitle}`:`[CRM] Task Assigned: ${e.taskTitle}`,htmlContent:function(e){let{taskTitle:t,assignedBy:a,priority:n,dueDate:i,description:o,ticketNumber:s,category:r,toName:l,language:d="en"}=e,c="fr"===d,p={urgent:"#dc2626",high:"#ea580c",medium:"#ca8a04",low:"#16a34a"},f=p[n||"medium"]||p.medium,m={en:{urgent:"URGENT",high:"High",medium:"Medium",low:"Low"},fr:{urgent:"URGENT",high:"Élevée",medium:"Moyenne",low:"Basse"}}[d]?.[n||"medium"]||n,u=l?c?`Bonjour ${l},`:`Dear ${l},`:c?"Bonjour,":"Hello,",g=c?`Une nouvelle t\xe2che vous a \xe9t\xe9 assign\xe9e dans le syst\xe8me CRM Attendance.`:"A new task has been assigned to you in the CRM Attendance system.";return`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; }
    .container { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #059669, #10b981); padding: 28px 32px; color: white; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
    .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.9; }
    .body { padding: 28px 32px; color: #334155; font-size: 15px; line-height: 1.6; }
    .body .greeting { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
    .task-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin: 20px 0; }
    .task-card h2 { margin: 0 0 12px; font-size: 17px; color: #0f172a; }
    .task-card .ticket { display: inline-block; background: #e0f2fe; color: #0369a1; font-size: 12px; font-family: monospace; padding: 3px 8px; border-radius: 4px; margin-bottom: 10px; }
    .priority-badge { display: inline-block; color: white; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #64748b; }
    .info-value { font-weight: 600; color: #1e293b; }
    .description { margin-top: 14px; padding: 12px 16px; background: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 0 6px 6px 0; font-size: 14px; color: #44403c; }
    .footer { padding: 20px 32px; background: #f8fafc; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
    .footer a { color: #059669; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${c?"Nouvelle Tâche Assignée":"New Task Assigned"}</h1>
      <p>CRM Attendance — ${c?"Système de Gestion":"Management System"}</p>
    </div>
    <div class="body">
      <p class="greeting">${u}</p>
      <p>${g}</p>
      <div class="task-card">
        ${s?`<div class="ticket">${s}</div>`:""}
        <h2>${t}</h2>
        <span class="priority-badge" style="background: ${f};">${m}</span>
        ${r?`&nbsp; <span style="display:inline-block; background:#f1f5f9; color:#475569; font-size:12px; padding:3px 10px; border-radius:20px; margin-left:6px;">${r}</span>`:""}
        <div style="margin-top: 16px;">
          <div class="info-row">
            <span class="info-label">${c?"Assigné par":"Assigned by"}</span>
            <span class="info-value">${a||"—"}</span>
          </div>
          ${i?`<div class="info-row">
            <span class="info-label">${c?"Date limite":"Due Date"}</span>
            <span class="info-value">${i}</span>
          </div>`:""}
        </div>
        ${o?`<div class="description">${o}</div>`:""}
      </div>
      <p style="font-size:13px; color:#64748b;">${c?"Merci de consulter le système CRM pour plus de détails.":"Please check the CRM system for more details."}</p>
    </div>
    <div class="footer">
      <p>${c?"Cet email a été envoyé automatiquement par le système CRM Attendance.":"This email was sent automatically by the CRM Attendance system."}</p>
      <p style="margin-top:4px;">&copy; ${new Date().getFullYear()} CRM Attendance</p>
    </div>
  </div>
</body>
</html>`}(e)})}e.s(["loadBrevoConfig",()=>n,"saveBrevoConfig",()=>a,"sendEmail",()=>i,"sendTaskAssignmentEmail",()=>o])},48503,e=>{e.v(t=>Promise.all(["static/chunks/adabfc2d4bff09a9.js"].map(t=>e.l(t))).then(()=>t(15833)))},70653,e=>{e.v(t=>Promise.all(["static/chunks/e3d896c59f43a040.js"].map(t=>e.l(t))).then(()=>t(24154)))},95111,e=>{e.v(t=>Promise.all(["static/chunks/5422262c1afaead6.js"].map(t=>e.l(t))).then(()=>t(38201)))},27581,e=>{e.v(e=>Promise.resolve().then(()=>e(11366)))},42078,e=>{e.v(t=>Promise.all(["static/chunks/8625699381285d4a.js"].map(t=>e.l(t))).then(()=>t(70016)))}]);