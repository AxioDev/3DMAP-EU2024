import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier';
import { feature } from 'topojson-client';
import { GUI } from 'dat.gui';

import jsonData from '../data/communes2024.json';
import { resultatsFE, liste_dict, communes_liste_tete } from '../data/comData';

console.log('Initialization log');

// Vertex shader
const vertexShader = `
    varying vec3 vNormal;
    void main() {
        vNormal = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

// Fragment shader
const fragmentShader = `
    uniform vec3 borderColor;
    uniform vec3 objectColor;
    varying vec3 vNormal;
    void main() {
        vec3 normal = normalize(vNormal);
        float borderWidth = 0.1; // Border width
        if (dot(normal, normalize(vec3(0.0, 0.0, 1.0))) > 0.95) {
            gl_FragColor = vec4(borderColor, 1.0); // Border color
        } else {
            gl_FragColor = vec4(objectColor, 1.0); // Object color
        }
    }
`;

// Create shader material
const materialShader = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
        borderColor: { value: new THREE.Color(0x000000) }, // Black border
        objectColor: { value: new THREE.Color(0x00ff00) }  // Green object
    },
    side: THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
});

console.log(resultatsFE);
console.log(jsonData);

const modifier = new SimplifyModifier();
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio); // For mobile device support
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

// Load the background texture
const textureLoader = new THREE.TextureLoader();
textureLoader.load('https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Flag_of_Europe.svg/2560px-Flag_of_Europe.svg.png', (texture) => {
    scene.background = texture;
});

const urls = [];
const deptMin = 1;
const deptMax = 95;

for (let i = deptMin; i <= deptMax; i++) {
    let dept = i < 10 ? '0' + i : i;
    if (dept === 20) {
        urls.push(
            'https://assets-decodeurs.lemonde.fr/decodeurs/elections_snippets/europeennes/exports2024/export_communes2A.json',
            'https://assets-decodeurs.lemonde.fr/decodeurs/elections_snippets/europeennes/exports2024/export_communes2B.json'
        );
    } else {
        urls.push(`https://assets-decodeurs.lemonde.fr/decodeurs/elections_snippets/europeennes/exports2024/export_communes${dept}.json`);
    }
}

console.log(urls);

const extrudeSettings = {
    steps: 2,
    depth: 10,
    bevelEnabled: false,
    bevelThickness: 0.1,
    bevelSize: 0.1,
    bevelOffset: 0,
    bevelSegments: 1
};

const getRandomColor = () => Math.random() * 0xffffff;

const fetchPromises = urls.map(url => 
    fetch(url).then(response => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    })
);

let deptDatas = {};
Promise.all(fetchPromises)
    .then(results => {
        deptDatas = results.reduce((acc, res) => ({ ...acc, ...res }), {});
        const geojson = feature(jsonData, jsonData.objects.a_com);
        createMap(geojson);
        animate();
    })
    .catch(error => console.error('Fetch request failed:', error));

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100000);
camera.position.set(-500, -500, 1000); // Less zoom by default
camera.up.set(0, 0, 1);

const controls = new OrbitControls(camera, renderer.domElement);
controls.listenToKeyEvents(window);
controls.enableDamping = true; // Enable damping (inertia) for smoother experience
controls.dampingFactor = 0.25;
controls.addEventListener('change', () => renderer.render(scene, camera));
controls.target.set(camera.position.x, camera.position.y, 0);
controls.update();

const axesHelper = new THREE.AxesHelper(50);
scene.add(axesHelper);

// Add more lights to brighten the scene
const ambientLight = new THREE.AmbientLight(0x404040, 2); // soft white light
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 2); // Increased intensity
hemiLight.color.setRGB(0.6, 0.6, 0.6);
hemiLight.position.set(500, -2000, 100);
scene.add(hemiLight);
scene.add(new THREE.HemisphereLightHelper(hemiLight, 10));

let mouse = new THREE.Vector2();
let raycaster = new THREE.Raycaster();
const meshes = [];

window.addEventListener('click', onMouseClick, false);

function onMouseClick(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
        const mesh = intersects[0].object;
        const properties = mesh.userData.properties;

        console.log(mesh, properties, deptDatas[properties.c]);
       
        guiParams.name = properties.l;
        guiParams.abstentions = deptDatas[properties.c].abstentions;
        guiParams.blancs = deptDatas[properties.c].blancs;
        guiParams.exprimes = deptDatas[properties.c].exprimes;
        guiParams.inscrits = deptDatas[properties.c].inscrits;
        guiParams.votants = deptDatas[properties.c].votants;
        guiParams.nuls = deptDatas[properties.c].nuls;

        const res = Object.entries(deptDatas[properties.c].res).sort((a, b) => b[1] - a[1]).slice(0, 3);

        for (let i = 1; i <= 3; i++) {
            guiParams[`res${i}_label`] = '';
            guiParams[`res${i}_value`] = '';
        }

        res.forEach((item, index) => {
            const listeId = item[0];
            const listeRealId = liste_dict[listeId].id;
            const info = resultatsFE.listes.find(liste => liste.num === listeRealId);

            guiParams[`res${index + 1}_label`] = info.nom_court;
            guiParams[`res${index + 1}_value`] = item[1];
        });

        gui.updateDisplay();
    }
}

const gui = new GUI();
const guiParams = {
    name: '',
    abstentions: '',
    blancs: '',
    exprimes: '',
    inscrits: '',
    nuls: '',
    votants: '',
    res1_label: '',
    res2_label: '',
    res3_label: '',
    res1_value: '',
    res2_value: '',
    res3_value: ''
};

gui.add(guiParams, 'name').name('Commune');
gui.add(guiParams, 'inscrits').name('Inscrits');
gui.add(guiParams, 'abstentions').name('Abstentions');
gui.add(guiParams, 'votants').name('Votants');
gui.add(guiParams, 'exprimes').name('Exprimés');
gui.add(guiParams, 'blancs').name('Blancs');
gui.add(guiParams, 'nuls').name('Nuls');

const resFolder = gui.addFolder('Résultats');
resFolder.add(guiParams, 'res1_label').name('Liste');
resFolder.add(guiParams, 'res1_value').name('Nb Votes');
resFolder.add(guiParams, 'res2_label').name('Liste');
resFolder.add(guiParams, 'res2_value').name('Nb Votes');
resFolder.add(guiParams, 'res3_label').name('Liste');
resFolder.add(guiParams, 'res3_value').name('Nb Votes');
resFolder.open();

function createMap(geojson) {
    console.log("Creating map...");
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    geojson.features.forEach(feature => {
        if (feature.properties.d < deptMin || feature.properties.d > deptMax) return;

        feature.geometry.coordinates.forEach(polygon => {
            if (feature.geometry.type === 'MultiPolygon') polygon = polygon[0];
            polygon.forEach(coord => {
                const [x, y] = coord;
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            });
        });
    });

    console.log("Bounds:", minX, minY, maxX, maxY);

    geojson.features.forEach(feature => {
        if (feature.properties.d < deptMin || feature.properties.d > deptMax) return;

        feature.geometry.coordinates.forEach(polygon => {
            if (feature.geometry.type === 'MultiPolygon') polygon = polygon[0];

            const shape = new THREE.Shape();
            polygon.forEach(([x, y], index) => {
                x = (x - maxX) / 1000;
                y = (y - maxY) / 1000;
                if (index === 0) {
                    shape.moveTo(x, y);
                } else {
                    shape.lineTo(x, y);
                }
            });

            const depth = deptDatas[feature.properties.c] ? deptDatas[feature.properties.c].votants / 300 : 1;
            const color = communes_liste_tete[feature.properties.c]
                ? resultatsFE.listes.find(liste => liste.num === liste_dict[communes_liste_tete[feature.properties.c]].id).couleur
                : '#000000';

            extrudeSettings.depth = depth;
            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            const material = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide });

            materialShader.uniforms.objectColor.value = new THREE.Color(color);
            const mesh = new THREE.Mesh(geometry, material);
            mesh.userData.properties = feature.properties;

            // // Create a border for each commune
            // const borderGeometry = new THREE.EdgesGeometry(geometry);
            // const borderMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
            // const border = new THREE.LineSegments(borderGeometry, borderMaterial);
            // mesh.add(border);

            meshes.push(mesh);
            scene.add(mesh);
        });
    });

}




function animate() {
    requestAnimationFrame(animate);
    controls.update(); // Required if controls.enableDamping or controls.autoRotate are set to true
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onWindowResize, false);
