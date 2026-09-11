const sampleData = {
    nome_armazem: 'Armazém ZUPLOG — Demo',
    dimensoes: { corredores: 5, posicoes_por_corredor: 20, niveis: 4 },
    posicoes: []
};

const products = ['PROD-A', 'PROD-B', 'PROD-C', 'PROD-D', 'PROD-E'];
let seed = 24681357;

const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
};

// Geração de dados falsos de estoque
for (let x = 0; x < 5; x++) {
    for (let y = 0; y < 20; y++) {
        for (let z = 0; z < 4; z++) {
            const ocupado = random() < .70;
            sampleData.posicoes.push({
                x,
                y,
                z,
                ocupado,
                produto: ocupado ? products[Math.floor(random() * products.length)] : null,
                quantidade: ocupado ? Math.floor(50 + random() * 450) : 0,
                data_entrada: ocupado ? '2026-08-' + String(Math.floor(1 + random() * 30)).padStart(2, '0') : null,
                giro: ocupado ? ['A', 'B', 'C'][Math.floor(random() * 3)] : null
            });
        }
    }
}

let data = sampleData;
let showLabels = false;
let meshes = [];

const canvas = document.getElementById('canvas');
const viewport = document.getElementById('viewport');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x07111f);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x07111f, 50, 120);

const camera = new THREE.PerspectiveCamera(48, 1, .1, 500);
camera.position.set(30, 36, 36);

const controls = new THREE.OrbitControls(camera, canvas);
controls.target.set(0, 7, 0);
controls.enableDamping = true;
controls.dampingFactor = .08;

scene.add(new THREE.HemisphereLight(0xaedaff, 0x132033, 2.4));
const dir = new THREE.DirectionalLight(0xffffff, 1.4);
dir.position.set(20, 38, 18);
scene.add(dir);

const grid = new THREE.GridHelper(72, 36, 0x29465f, 0x142a3d);
scene.add(grid);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const colors = { A: 0x28c98b, B: 0x3aa6ff, C: 0xa777ff, free: 0x506171 };

const rackGeom = new THREE.BoxGeometry(1.8, 2.4, 1.35);
const edgeGeom = new THREE.EdgesGeometry(rackGeom);
const labelCanvas = document.createElement('canvas');

function material(color, opacity = 1) {
    return new THREE.MeshStandardMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        roughness: .55,
        metalness: .12
    });
}

function positionCode(p) {
    return `R${String(p.x + 1).padStart(2, '0')}-M${String(p.y + 1).padStart(2, '0')}-N${p.z + 1}`;
}

function addLabel(text, pos) {
    const c = labelCanvas.cloneNode();
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#eaf2fb';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 38);
    const t = new THREE.CanvasTexture(c);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true }));
    s.scale.set(3, 0.75, 1);
    s.position.copy(pos);
    s.visible = showLabels;
    scene.add(s);
    return s;
}

function clearWarehouse() {
    meshes.forEach(o => scene.remove(o));
    meshes = [];
}

function renderWarehouse() {
    clearWarehouse();
    const status = document.getElementById('status').value;
    const giro = document.getElementById('turnover').value;
    const product = document.getElementById('product').value;
    const maxLevel = +document.getElementById('level').value;

    data.posicoes.forEach(p => {
        if (p.z + 1 > maxLevel) return;
        if (status === 'occupied' && !p.ocupado) return;
        if (status === 'free' && p.ocupado) return;
        if (giro !== 'all' && p.giro !== giro) return;
        if (product !== 'all' && p.produto !== product) return;

        const x = (p.x - (data.dimensoes.corredores - 1) / 2) * 4.5;
        const z = (p.y - (data.dimensoes.posicoes_por_corredor - 1) / 2) * 2.15;
        const y = p.z * 2.65 + 1.25;

        const group = new THREE.Group();
        group.position.set(x, y, z);
        
        const color = p.ocupado ? colors[p.giro] : colors.free;
        const box = new THREE.Mesh(rackGeom, material(color, p.ocupado ? .94 : .24));
        box.userData = p;
        group.add(box);
        
        const edges = new THREE.LineSegments(edgeGeom, new THREE.LineBasicMaterial({
            color: p.ocupado ? 0xe9f7ff : 0x718092,
            transparent: true,
            opacity: .65
        }));
        group.add(edges);

        const label = addLabel(positionCode(p), new THREE.Vector3(x, y + 1.55, z));
        group.userData = { p, box, label };
        
        meshes.push(group);
        scene.add(group);
    });

    updateMetrics();
}

function updateMetrics() {
    const total = data.posicoes.length;
    const occupied = data.posicoes.filter(p => p.ocupado);
    const free = total - occupied.length;
    const units = occupied.reduce((s, p) => s + p.quantidade, 0);

    document.getElementById('occupation').textContent = (occupied.length / total * 100).toFixed(1) + '%';
    document.getElementById('occupied').textContent = occupied.length;
    document.getElementById('free').textContent = free;
    document.getElementById('units').textContent = units.toLocaleString('pt-BR');

    const c = data.dimensoes.corredores;
    const n = data.dimensoes.niveis;
    const byAisle = Array.from({ length: c }, (_, i) => data.posicoes.filter(p => p.x === i && p.ocupado).length / (data.dimensoes.posicoes_por_corredor * n));
    const max = Math.max(...byAisle);
    const idx = byAisle.indexOf(max) + 1;

    document.getElementById('insights').innerHTML = `Corredor <strong>R${String(idx).padStart(2, '0')}</strong> tem a maior ocupação: <strong>${(max * 100).toFixed(1)}%</strong>.<br>Use a visão por giro para reposicionar SKUs A próximos à expedição e liberar áreas de baixo giro.`;
}

function resetView() {
    camera.position.set(30, 36, 36);
    controls.target.set(0, 7, 0);
    controls.update();
}

function resize() {
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}

window.addEventListener('resize', resize);
resize();

canvas.addEventListener('click', e => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    
    const hit = raycaster.intersectObjects(meshes, true).find(i => i.object.userData && i.object.userData.x !== undefined);
    const tip = document.getElementById('tooltip');
    
    if (!hit) {
        tip.style.display = 'none';
        return;
    }
    
    const p = hit.object.userData;
    tip.innerHTML = `<b>${positionCode(p)}</b><br>
                     Status: <b style="color:${p.ocupado ? '#28c98b' : '#a5b3c2'}">${p.ocupado ? 'Ocupada' : 'Livre'}</b>
                     ${p.ocupado ? `<br>SKU: <b>${p.produto}</b><br>Quantidade: <b>${p.quantidade.toLocaleString('pt-BR')}</b><br>Curva: <b>${p.giro}</b><br>Entrada: ${p.data_entrada}` : ''}`;
    
    tip.style.display = 'block';
    tip.style.left = Math.min(e.clientX - r.left + 14, r.width - 285) + 'px';
    tip.style.top = Math.min(e.clientY - r.top + 14, r.height - 160) + 'px';
});

['status', 'turnover', 'product', 'level'].forEach(id => document.getElementById(id).addEventListener('input', () => {
    document.getElementById('levelLabel').textContent = document.getElementById('level').value;
    renderWarehouse();
}));

document.getElementById('reset').onclick = resetView;

document.getElementById('toggleLabels').onclick = () => {
    showLabels = !showLabels;
    meshes.forEach(g => g.userData.label.visible = showLabels);
    document.getElementById('toggleLabels').textContent = showLabels ? 'Ocultar rótulos' : 'Mostrar rótulos';
};

function loadData(newData) {
    data = newData;
    document.getElementById('warehouseName').textContent = data.nome_armazem || 'Armazém';
    
    const prodSelect = document.getElementById('product');
    prodSelect.innerHTML = '<option value="all">Todos os produtos</option>';
    
    [...new Set(data.posicoes.filter(p => p.produto).map(p => p.produto))].sort().forEach(p => prodSelect.add(new Option(p, p)));
    
    const max = data.dimensoes.niveis || Math.max(...data.posicoes.map(p => p.z)) + 1;
    document.getElementById('level').max = max;
    document.getElementById('level').value = max;
    document.getElementById('levelLabel').textContent = max;
    
    renderWarehouse();
    resetView();
}

async function tryLoadJSON() {
    try {
        const r = await fetch('estoque_3D.json');
        if (r.ok) loadData(await r.json());
        else loadData(sampleData);
    } catch (e) {
        loadData(sampleData);
    }
}

tryLoadJSON();

(function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
})();