import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier';
import { feature } from 'topojson-client';
import { GUI } from 'dat.gui';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';
import * as unorm from 'unorm';

import jsonData from '../data/communes2024.json';
import { resultatsFE, liste_dict, communes_liste_tete } from '../data/comData';

console.log('Initialization log');
const tailwindColors = [
    '#f8fafc', // slate-50
    '#475569', // slate-600
    '#f9fafb', // gray-50
    '#6b7280', // gray-500
    '#fef2f2', // red-50
    '#ef4444', // red-500
    '#ecfdf5', // green-50
    '#10b981', // green-500
    '#eff6ff', // blue-50
    '#3b82f6', // blue-500
    '#fdf2f8', // pink-50
    '#ec4899', // pink-500
    '#fff7ed', // orange-50
    '#f97316', // orange-500
    '#fefce8', // yellow-50
    '#eab308', // yellow-500
    '#f5f3ff', // purple-50
    '#8b5cf6', // purple-500
    '#f0fdf4', // lime-50
    '#84cc16'  // lime-500
];
function getRandomTailwindColor() {
    const randomIndex = Math.floor(Math.random() * tailwindColors.length);
    return tailwindColors[randomIndex];
}
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
const loader = new THREE.TextureLoader();
loader.load('https://i.ibb.co/vLMGBXR/gradient-1.png', function(texture) {
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
let font;
const fontLoader = new FontLoader();
fontLoader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', (loadedFont) => {
    font = loadedFont;
    Promise.all(fetchPromises)
        .then(results => {
            deptDatas = results.reduce((acc, res) => ({ ...acc, ...res }), {});
            const geojson = feature(jsonData, jsonData.objects.a_com);
            createMap(geojson);
            animate();
        })
        .catch(error => console.error('Fetch request failed:', error));
});

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100000);
camera.position.set(-500, -500, 1100); // Less zoom by default
camera.up.set(0, 0, 1);

const controls = new OrbitControls(camera, renderer.domElement);
controls.listenToKeyEvents(window);
controls.enableDamping = true; // Enable damping (inertia) for smoother experience
controls.dampingFactor = 0.25;
controls.addEventListener('change', () => renderer.render(scene, camera));
controls.target.set(camera.position.x, camera.position.y, 0);
controls.update();

// const axesHelper = new THREE.AxesHelper(50);
// scene.add(axesHelper);

// Add more lights to brighten the scene
const ambientLight = new THREE.AmbientLight(0x404040, 4); // soft white light
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 3); // Increased intensity
hemiLight.color.setRGB(0.6, 0.6, 0.6);
hemiLight.position.set(500, -2000, 100);
scene.add(hemiLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 5); // Added directional light with high intensity
directionalLight.position.set(0, 0, 1000).normalize();
scene.add(directionalLight);

scene.add(new THREE.HemisphereLightHelper(hemiLight, 10));

let mouse = new THREE.Vector2();
let raycaster = new THREE.Raycaster();
const meshes = [];

let hoverTimeout;

window.addEventListener('mousemove', onMouseMove, false);
window.addEventListener('click', onMouseHover, false);
//touch event
window.addEventListener('touchstart', onMouseHover, false);

function onMouseMove(event) {
    clearTimeout(hoverTimeout);
    hoverTimeout = setTimeout(() => onMouseHover(event), 2000);
    onMouseHover(event); // Update border immediately
}

function onMouseHover(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(meshes);

    meshes.forEach(mesh => {
        mesh.userData.hovered = false;
        if (mesh.userData.border) {
            mesh.remove(mesh.userData.border);
            mesh.userData.border = null;
        }
    });

    if (intersects.length > 0) {
        const mesh = intersects[0].object;
        mesh.userData.hovered = true;
        const borderGeometry = new THREE.EdgesGeometry(mesh.geometry);
        const borderMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
        const border = new THREE.LineSegments(borderGeometry, borderMaterial);
        mesh.add(border);
        mesh.userData.border = border;

        showInfoBubble(mesh, event.clientX, event.clientY);
    } else {
        hideInfoBubble();
    }
}

function showInfoBubble(mesh, x, y) {
    const infoBubble = document.getElementById('info-bubble');
    const properties = mesh.userData.properties;
    const data = deptDatas[properties.c];

    // Calculate the winner and their score
    const resEntries = Object.entries(data.res).sort((a, b) => b[1] - a[1]);
    const winner = resEntries[0];
    const winnerName = resultatsFE.listes.find(liste => liste.num === liste_dict[winner[0]].id).nom_court;
    const winnerScore = winner[1];

    // Prepare the scores of all candidates
    const scoresHTML = resEntries.map(entry => {
        const candidateName = resultatsFE.listes.find(liste => liste.num === liste_dict[entry[0]].id).nom_court;
        return `${candidateName}: ${entry[1]}<br>`;
    }).join('');

    infoBubble.innerHTML = `
        <strong>${properties.l}</strong><hr>
        Inscrits: ${data.inscrits}<br>
        Abstentions: ${data.abstentions}<br>
        Blancs: ${data.blancs}<br>
        Nuls: ${data.nuls}<br>
        Votants: ${data.votants}<br>
        Exprimés: ${data.exprimes}<br>
        <hr>
        <strong>Gagnant: ${winnerName}</strong> (${winnerScore} votes)<br>
        <hr>
        <strong>Scores:</strong><br>
        <div style="max-height: 200px; overflow-y: auto;">
        ${scoresHTML}
        </div>
    `;
    infoBubble.style.left = `${x + 10}px`;
    infoBubble.style.top = `${y + 10}px`;
    infoBubble.style.display = 'block';
}


function hideInfoBubble() {
    const infoBubble = document.getElementById('info-bubble');
    infoBubble.style.display = 'none';
}

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
    let parisDisplayed = false; // Add this line

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

            // Create a border only if the commune has more than 10000 votes
            if (deptDatas[feature.properties.c] && deptDatas[feature.properties.c].votants > 20000) {
                // const borderGeometry = new THREE.EdgesGeometry(geometry);
                // const borderMaterial = new THREE.LineBasicMaterial({ 
                //     color: color, 
                //     linewidth: 5 });
                // const border = new THREE.LineSegments(borderGeometry, borderMaterial);
                // mesh.add(border);

                // Calculate the centroid of the polygon
                let centroidX = 0, centroidY = 0, numPoints = 0;
                polygon.forEach(([x, y]) => {
                    centroidX += x;
                    centroidY += y;
                    numPoints++;
                });
                centroidX /= numPoints;
                centroidY /= numPoints;
                centroidX = (centroidX - maxX) / 1000;
                centroidY = (centroidY - maxY) / 1000;

                let cityName = unorm.nfkd(feature.properties.l).replace(/[\u0300-\u036f]/g, ""); // Normalize and remove accents

                // remove the word arrondissement from the name
                if (cityName.toLowerCase().toLowerCase().includes("arrondissement")) {
                    // remove the word arrondissement from the name
                    cityName = cityName.replace(/arrondissement/gi, "");
                }

                // Add city name above the extrusion at the centroid
                const textGeometry = new TextGeometry(cityName, {
                    font: font,
                    size: 1 * (depth / 12),
                    depth: 5,
                    curveSegments: 12
                });
                
                const textMaterial = [
                    new THREE.MeshBasicMaterial({ color: color }), // Front: random color
                    new THREE.MeshBasicMaterial({ color: 0x000000 }) // Side: black
                ];
                
                const textMesh = new THREE.Mesh(textGeometry, textMaterial);
                textGeometry.computeBoundingBox();
                const textWidth = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
                textMesh.position.set(centroidX - textWidth / 2, centroidY, depth + 1); // Centering the text above the extrusion at the centroid
                scene.add(textMesh);
                
            }

            meshes.push(mesh);
            scene.add(mesh);
        });
    });
}

// Create the legend
function createLegend() {
    const legend = document.getElementById('legend');
    const legendItems = resultatsFE.listes.map(liste => {
        const item = document.createElement('div');
        item.className = 'legend-item';

        const colorBox = document.createElement('div');
        colorBox.className = 'legend-color';
        colorBox.style.backgroundColor = liste.couleur;

        const label = document.createElement('span');
        label.textContent = liste.nom_court;

        item.appendChild(colorBox);
        item.appendChild(label);

        return item;
    });

    legendItems.forEach(item => legend.appendChild(item));
}

createLegend();

function animate() {
    requestAnimationFrame(animate);
    controls.update(); // Required if controls.enableDamping or controls.autoRotate are set to true
    animateStars(); 
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Function to create a star shape
function createStarShape() {
    const starShape = new THREE.Shape();
    const outerRadius = 80; // Increased size
    const innerRadius = 40; // Increased size
    const spikes = 5;
    const step = Math.PI / spikes;

    for (let i = 0; i < 2 * spikes; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const x = Math.cos(i * step) * radius;
        const y = Math.sin(i * step) * radius;
        if (i === 0) {
            starShape.moveTo(x, y);
        } else {
            starShape.lineTo(x, y);
        }
    }

    starShape.closePath();
    return starShape;
}

// Function to create stars in wireframe
function createStars() {
    const starShape = createStarShape();
    const starGeometry = new THREE.ShapeGeometry(starShape);
    const starMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const stars = new THREE.Group();

    const distanceFromCenter = 800; // Distance from the center
    for (let i = 0; i < 12; i++) { // 12 stars for the European flag
        const star = new THREE.Mesh(starGeometry, starMaterial);
        const angle = (i / 12) * Math.PI * 2;
        star.position.set(Math.cos(angle) * distanceFromCenter, Math.sin(angle) * distanceFromCenter, 0);
        stars.add(star);
    }

    stars.position.set(-500, -500, -100); // Center the stars group at the origin

    return stars;
}

// Add stars to the scene
const stars = createStars();

scene.add(stars);

// Animation function to make stars move
function animateStars() {
    stars.rotation.z += 0.01; // Rotate the group of stars
}


window.addEventListener('resize', onWindowResize, false);
