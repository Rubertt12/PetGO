// ------------------ Inicializa mapa ------------------
let map = L.map('map'); // view será definida depois
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
let markers = L.layerGroup().addTo(map);

// ------------------ Storage ------------------
const STORAGE_KEY = 'petgo_animais';
let data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let score = 0;

// ------------------ DOM ------------------
const modal = document.getElementById('modal');
const btnReport = document.getElementById('btnReport');
const btnClose = document.getElementById('btnClose');
const btnSnap = document.getElementById('btnSnap');
const btnSend = document.getElementById('btnSend');
const btnToggleCam = document.getElementById('btnToggleCam');
const video = document.getElementById('video');
const imgPreview = document.getElementById('imgPreview');
const tipoSel = document.getElementById('tipoAnimal');
const statusSel = document.getElementById('statusAnimal');
const toast = document.getElementById('toast');
const btnHistory = document.getElementById('btnHistory');
const sidebar = document.getElementById('sidebar');
const btnCloseHistory = document.getElementById('btnCloseHistory');
const historyList = document.getElementById('historyList');
const searchHistory = document.getElementById('searchHistory');
const btnExport = document.getElementById('btnExport');
const btnHeat = document.getElementById('btnHeat');
const scoreEl = document.getElementById('score');
const themeToggle = document.getElementById('themeToggle');

let stream = null, facing = 'environment', photo = null, heatLayer = null;
let detectedObjects = [];

// ------------------ FUNÇÕES ------------------
function showToast(msg){
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(()=>toast.classList.remove('show'),2000);
}

async function startCamera(){
    if(stream) stream.getTracks().forEach(t=>t.stop());
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
        video.srcObject = stream;
        video.style.display = '';
        imgPreview.style.display = 'none';
        photo = null;
    } catch(e){ showToast('Erro ao acessar câmera'); console.error(e); }
}

function addMarker(r){
    let iconUrl = r.tipo==='cachorro'?'https://cdn-icons-png.flaticon.com/512/194/194279.png':
                  r.tipo==='gato'?'https://cdn-icons-png.flaticon.com/512/194/194931.png':
                  'https://cdn-icons-png.flaticon.com/512/616/616408.png';
    let icon = L.icon({ iconUrl, iconSize:[40,40], iconAnchor:[20,40] });
    
    // Zona de avistamento do animal
    const zona = L.circle([r.lat,r.lng], { radius:20, color:'red', fillOpacity:0.2 }).addTo(map);

    L.marker([r.lat, r.lng], { icon })
     .addTo(markers)
     .bindPopup(`<b>${r.tipo}</b><br>${r.status}<br>${r.endereco}<br><a href="${r.map_link}" target="_blank">Abrir no Google Maps</a><br><img src="${r.foto}" width="100">`);
}

function renderHistory(filter=''){
    historyList.innerHTML = '';
    data.filter(r=>r.tipo.toLowerCase().includes(filter.toLowerCase()) || r.status.toLowerCase().includes(filter.toLowerCase()))
        .forEach((r,i)=>{
            let li = document.createElement('li'); li.classList.add('history-item');
            li.innerHTML = `<img src="${r.foto}"><div><b>${r.tipo}</b><br>${r.status}<br>${r.endereco}<br>${new Date(r.timestamp).toLocaleString()}<br><a href="#" data-i="${i}">Ver no mapa</a></div>`;
            li.querySelector('a').addEventListener('click', e=>{
                e.preventDefault();
                map.setView([r.lat,r.lng],17);
                sidebar.classList.remove('show');
            });
            historyList.appendChild(li);
        });
}

function updateScoreAndBadges(){ 
    let badges=''; 
    if(score>=20) badges='🥇'; 
    else if(score>=10) badges='🥈'; 
    else if(score>=5) badges='🥉'; 
    scoreEl.textContent=`🏆 ${score} pts ${badges}`; 
}

function toggleHeatmap(){
    if(heatLayer){ map.removeLayer(heatLayer); heatLayer=null; showToast('Heatmap desligado'); return; }
    let points = data.map(r=>[r.lat,r.lng,0.6]);
    heatLayer = L.heatLayer(points,{radius:25,blur:20}).addTo(map);
    showToast('Heatmap ligado');
}

function exportJSON(){
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='petgo_data.json'; a.click();
    URL.revokeObjectURL(url);
    showToast('JSON exportado');
}

function toggleTheme(){
    document.body.classList.toggle('dark-theme');
    themeToggle.textContent = document.body.classList.contains('dark-theme')?'☀️':'🌙';
}

function compressImage(dataURL, maxWidth=200, maxHeight=200){
    return new Promise(resolve=>{
        const img = new Image();
        img.onload = ()=>{
            let w=img.width, h=img.height;
            if(w>maxWidth){ h*= maxWidth/w; w=maxWidth; }
            if(h>maxHeight){ w*= maxHeight/h; h=maxHeight; }
            const canvas=document.createElement('canvas');
            canvas.width=w; canvas.height=h;
            canvas.getContext('2d').drawImage(img,0,0,w,h);
            resolve(canvas.toDataURL('image/jpeg',0.5));
        };
        img.src = dataURL;
    });
}

async function getAddress(lat,lng){
    try{
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
        const d = await res.json();
        return d.display_name || "Endereço não encontrado";
    }catch(e){ console.error(e); return "Endereço não encontrado"; }
}

emailjs.init("Hx4D4KkKfCSUb_xQR"); // sua Public Key

function sendEmail(rec){
    compressImage(rec.foto).then(compressed=>{
        emailjs.send("service_thylr79","template_07vxayl",{
            tipo: rec.tipo,
            status: rec.status,
            lat: rec.lat,
            lng: rec.lng,
            endereco: rec.endereco,
            map_link: rec.map_link,
            timestamp: rec.timestamp,
            foto: compressed,
            para: "ruberttramires4@gmail.com"
        }).then(()=> console.log('Email enviado com foto comprimida'))
          .catch(e=> console.error('Erro no envio de email:', e));
    });
}

function showONGNotification(rec){
    const ongDiv=document.createElement('div');
    ongDiv.className='toast';
    ongDiv.textContent=`ONG ALERT: ${rec.tipo} (${rec.status}) avistado!`;
    document.body.appendChild(ongDiv);
    ongDiv.classList.add('show');
    setTimeout(()=> ongDiv.remove(),3000);
}

// ------------------ Função COCO-SSD ------------------
let model = null;
async function loadModel(){
    model = await cocoSsd.load();
}
loadModel();

async function checkAnimal(photoData){
    if(!model) return false;
    const img = new Image();
    img.src = photoData;
    await new Promise(r=>img.onload=r);
    const predictions = await model.detect(img);
    detectedObjects = predictions;
    return predictions.some(p => ['cat','dog','bird'].includes(p.class));
}

// ------------------ EVENTOS ------------------
btnReport.addEventListener('click', ()=>{
    modal.classList.add('show');
    video.style.display=''; imgPreview.style.display='none'; photo=null;
    startCamera();
});

btnClose.addEventListener('click', ()=>{
    modal.classList.remove('show');
    if(stream) stream.getTracks().forEach(t=>t.stop());
    photo=null; imgPreview.src=''; video.style.display='';
});

btnSnap.addEventListener('click', async ()=>{
    if(!video.videoWidth){ showToast('Câmera não pronta'); return; }
    const canvas=document.createElement('canvas');
    canvas.width=video.videoWidth; canvas.height=video.videoHeight;
    canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
    photo=canvas.toDataURL('image/png');
    
    const hasAnimal = await checkAnimal(photo);
    if(!hasAnimal){ showToast('Nenhum animal identificado!'); photo=null; return; }

    imgPreview.src=photo; imgPreview.style.display=''; video.style.display='none';
    showToast('Animal detectado! Pode enviar.');
});

btnToggleCam.addEventListener('click', ()=>{
    facing = (facing==='environment')?'user':'environment';
    startCamera();
});

btnSend.addEventListener('click', ()=>{
    if(!photo){ showToast('Tire uma foto com animal primeiro'); return; }
    if(!navigator.geolocation){ showToast('Geolocalização indisponível'); return; }

    navigator.geolocation.getCurrentPosition(async pos=>{
        const rec = {
            foto: photo,
            tipo: tipoSel.value,
            status: statusSel.value,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            timestamp: new Date().toISOString()
        };
        rec.endereco = await getAddress(rec.lat, rec.lng);
        rec.map_link = `https://www.google.com/maps?q=${rec.lat},${rec.lng}`;
        data.unshift(rec);
        data = data.slice(0,50);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

        addMarker(rec);
        score+=10; updateScoreAndBadges();
        modal.classList.remove('show');
        if(stream) stream.getTracks().forEach(t=>t.stop());
        renderHistory();
        showToast('Animal registrado!');
        sendEmail(rec);
        showONGNotification(rec);
    }, ()=>showToast('Erro na localização'));
});

btnHistory.addEventListener('click', ()=>{
    sidebar.classList.toggle('show');
    renderHistory();
});
btnCloseHistory.addEventListener('click', ()=> sidebar.classList.remove('show'));
searchHistory.addEventListener('input', ()=> renderHistory(searchHistory.value));
btnExport.addEventListener('click', exportJSON);
btnHeat.addEventListener('click', toggleHeatmap);
themeToggle.addEventListener('click', toggleTheme);

// ------------------ Centraliza mapa na posição do usuário ------------------
if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(pos=>{
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        map.setView([lat, lng], 15);
    }, err=>{
        map.setView([-30.0346, -51.2177], 15); // fallback
    });
} else {
    map.setView([-30.0346, -51.2177], 15);
}

// ------------------ Inicial render ------------------
data.forEach(addMarker);
updateScoreAndBadges();
