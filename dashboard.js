// dashboard.js
// URL del Apps Script (reemplaza si usas otra)
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwKHGHS4o6HJK9j3-QEX4iev5ElHoQFWwTcvrGU45_ssIRglXzuBLTtguxeR-MG2pZY/exec";

let cachedRows = null;
let barChart = null;

// Cierre de sesión simple
function logout(){
  localStorage.removeItem("logged");
  window.location.href = "index.html";
}

// Petición para leer datos del sheet (GET)
async function fetchRows(){
  try {
    const resp = await fetch(APPS_SCRIPT_URL + "?read=true");
    // Si Apps Script no devuelve JSON por permisos, esto fallará
    const rows = await resp.json();
    // rows = array de arrays (como sheet.getValues())
    cachedRows = rows;
    return rows;
  } catch (err) {
    console.error("Error al leer datos:", err);
    alert("No se pudieron cargar los datos. Revisa la URL del Apps Script y su despliegue.");
    throw err;
  }
}

// Transformar rows (espera que la hoja tenga encabezado en fila 1)
// Asumimos: [Timestamp, Tipo, Categoria, Monto, Descripcion, Fecha]
function parseRows(rows){
  if (!rows || !rows.length) return [];

  // Si la primera fila es encabezado (texto), la eliminamos
  const first = rows[0];
  const isHeader = typeof first[0] === "string" && first[0].toLowerCase().includes("timestamp");
  const dataRows = isHeader ? rows.slice(1) : rows;

  return dataRows.map(r => ({
    timestamp: r[0],
    tipo: r[1],
    categoria: r[2],
    monto: parseFloat(r[3]) || 0,
    descripcion: r[4],
    fecha: r[5] // esperamos formato YYYY-MM-DD o similar
  }));
}

// Calcular totales y series por mes
function calcMonthly(data){
  const ingresos = data.filter(d => d.tipo === "Ingreso").reduce((s,x)=>s + x.monto, 0);
  const gastos = data.filter(d => d.tipo === "Gasto").reduce((s,x)=>s + x.monto, 0);

  const months = {}; // key YYYY-MM
  data.forEach(d => {
    let m = d.fecha;
    if (!m) {
      // si no hay fecha, intentar con timestamp
      const t = new Date(d.timestamp);
      if (!isNaN(t)) {
        m = t.toISOString().substr(0,7);
      } else {
        return;
      }
    } else {
      // normalizar a YYYY-MM si viene con hora
      m = m.substr(0,7);
    }
    if (!months[m]) months[m] = 0;
    months[m] += (d.tipo === "Ingreso" ? d.monto : -d.monto);
  });

  // ordenar por mes ascendente
  const labels = Object.keys(months).sort();
  const values = labels.map(l => months[l]);

  return { ingresos, gastos, balance: ingresos - gastos, labels, values };
}

// Renderizar en la UI
function renderUI(calc){
  document.getElementById("totalIngresos").textContent = "$" + numberWithCommas(calc.ingresos.toFixed(2));
  document.getElementById("totalGastos").textContent = "$" + numberWithCommas(calc.gastos.toFixed(2));
  document.getElementById("balance").textContent = "$" + numberWithCommas(calc.balance.toFixed(2));
}

// Renderizar gráfica con rango seleccionado
function renderChart(labels, values){
  const range = parseInt(document.getElementById("range").value, 10) || 12;
  // tomar últimos `range` puntos
  const start = Math.max(0, labels.length - range);
  const selLabels = labels.slice(start);
  const selValues = values.slice(start);

  const ctx = document.getElementById("barChart").getContext("2d");
  if (barChart) barChart.destroy();

  barChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: selLabels,
      datasets: [{
        label: "Balance mensual (MXN)",
        data: selValues,
        borderWidth: 1
      }]
    },
    options: {
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

// Util: formato
function numberWithCommas(x){
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Flujo principal
async function loadAndRender(){
  try {
    const rows = await fetchRows();
    const parsed = parseRows(rows);
    const calc = calcMonthly(parsed);
    renderUI(calc);
    renderChart(calc.labels, calc.values);
  } catch (e) {
    console.error(e);
  }
}

// Refresh manual
function refresh(){
  cachedRows = null;
  loadAndRender();
}

// Render desde cache y solo cambiar rango (cuando el usuario cambia rango)
function renderFromCache(){
  if (!cachedRows) {
    loadAndRender();
    return;
  }
  const parsed = parseRows(cachedRows);
  const calc = calcMonthly(parsed);
  renderUI(calc);
  renderChart(calc.labels, calc.values);
}

// Inicializamos
document.addEventListener("DOMContentLoaded", ()=> {
  // seguridad: solo mostrar si logged
  if (localStorage.getItem("logged") !== "yes") {
    window.location.href = "index.html";
    return;
  }
  loadAndRender();
});
