import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import jsonData from '../data/communes2024.json';
import { feature } from 'topojson-client';
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier';

import { resultatsFE, liste_dict, communes_liste_tete } from '../data/comData';
import { GUI } from 'dat.gui'

let guiParams = {};

console.log('ifidusfidsiufids');

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
        float borderWidth = 0.1; // Largeur de la bordure

        // Si la normale est face à la caméra, c'est une partie de la bordure
        if (dot(normal, normalize(vec3(0.0, 0.0, 1.0))) > 0.95) {
            gl_FragColor = vec4(borderColor, 1.0); // Couleur de la bordure
        } else {
            gl_FragColor = vec4(objectColor, 1.0); // Couleur de l'objet
        }
    }
`;

// Création du matériau avec le shader
const materialShader = new THREE.ShaderMaterial({
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    uniforms: {
        borderColor: { value: new THREE.Color(0x000000) }, // Couleur de la bordure (noir)
        objectColor: { value: new THREE.Color(0x00ff00) }   // Couleur de l'objet (vert)
    },
    side: THREE.FrontSide, // La bordure est visible de l'extérieur
    polygonOffset: true, // Pour éviter le z-fighting
    polygonOffsetFactor: 1, // Facteur de décalage
    polygonOffsetUnits: 1 // Unités de décalage
});

console.log(resultatsFE);
console.log(jsonData);
const modifier = new SimplifyModifier();
const renderer = new THREE.WebGLRenderer();

renderer.setSize(window.innerWidth, window.innerHeight);

document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const urls = [];

const deptMin = 1;
const deptMax = 95;

for (let i = deptMin; i <= deptMax; i++) {

    if (i < 10) {
        i = '0' + i;
    }
    if (i == 20) {
        urls.push('https://assets-decodeurs.lemonde.fr/decodeurs/elections_snippets/europeennes/exports2024/export_communes2A.json');
        urls.push('https://assets-decodeurs.lemonde.fr/decodeurs/elections_snippets/europeennes/exports2024/export_communes2B.json');
        continue;
    }
    urls.push('https://assets-decodeurs.lemonde.fr/decodeurs/elections_snippets/europeennes/exports2024/export_communes' + i + '.json');
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

function getRandomColor() {
    return Math.random() * 0xffffff;
}

const fetchPromises = urls.map(url => fetch(url).then(response => {
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}));
let deptDatas = {};
Promise.all(fetchPromises)
    .then(results => {
        // Ici, results est un tableau des résultats de chaque fetch
        // results = results.map(elt => 'x');
        // deptDatas = results.reduce((acc, currentObject) => {
        //     console.log("Reducing...", ...currentObject);
        //     return { ...acc, ...currentObject };
        //   }, {});

        const out = {};
        for (let res of results) {
            for (let deptData in res) {
                out[deptData] = res[deptData];
            }
        }
        deptDatas = out;
        const geojson = feature(jsonData, jsonData.objects.a_com);
        createMap(geojson);
        renderer.render(scene, camera);
        // Vous pouvez continuer votre code ici




    })
    .catch(error => {
        // Si l'une des promesses est rejetée, vous pouvez traiter l'erreur ici
        console.error('One of the fetch requests failed:', error);
    });


const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    100000
);


const axesHelper = new THREE.AxesHelper(50);
scene.add(axesHelper);
camera.position.set(-500, -500, 500);
camera.up.set(0, 0, 1)

const controls = new OrbitControls(camera, renderer.domElement);
controls.listenToKeyEvents(window);
controls.addEventListener('change', () => { renderer.render(scene, camera) });
controls.update();
controls.target.set(camera.position.x, camera.position.y, 0);
controls.update();


const light = new THREE.AmbientLight(0xFFFFFF); // soft white light
// scene.add( light );


const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 2);
hemiLight.color.setRGB(0.3, 0.3, 0.3);
// hemiLight.groundColor.setHSL( 0.095, 1, 0.75 );
hemiLight.position.set(500, -2000, 50);
scene.add(hemiLight);

const hemiLightHelper = new THREE.HemisphereLightHelper(hemiLight, 10);
scene.add(hemiLightHelper);



let mouse, raycaster;
const meshes = [];
raycaster = new THREE.Raycaster();
mouse = new THREE.Vector2();
window.addEventListener('click', onMouseClick, false);
function onMouseClick(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
        const mesh = intersects[0].object;
        const properties = mesh.userData.properties;
        // const infos = info_commune[id_commune];
        console.log(mesh, properties, deptDatas[properties.c]);
       
        guiParams.name = properties.l;
        guiParams.abstentions = deptDatas[properties.c].abstentions;
        guiParams.blancs = deptDatas[properties.c].blancs;
        guiParams.exprimes = deptDatas[properties.c].exprimes;
        guiParams.inscrits = deptDatas[properties.c].inscrits;
        guiParams.votants = deptDatas[properties.c].votants;
        guiParams.nuls = deptDatas[properties.c].nuls;



        let res = deptDatas[properties.c].res;
        const entries = Object.entries(res);

        // Étape 2 : Trier le tableau par les valeurs (valeur croissante)
        console.log(entries);
        entries.sort((a, b) => b[1] - a[1]);
        console.log(entries, entries.slice(0, 3));
        const resOrdered = entries.slice(0, 3);


        let i = 1;
        for (let i of [1, 2, 3]) {
            guiParams['res' + i + '_label'] = '';
            guiParams['res' + i + '_value'] = '';
        }
        console.log('resOrdered', resOrdered);
        i = 1;
        for (let j in resOrdered) {
            let listeId = resOrdered[j][0];
            console.log("listeId", listeId);
            let listeRealId = liste_dict[listeId].id;

            let infos = resultatsFE.listes.filter(liste => liste.num == listeRealId)[0];
            console.log(infos.nom_court, resOrdered[j]);
            guiParams['res' + i + '_label'] = infos.nom_court;
            guiParams['res' + i + '_value'] = resOrdered[j][1];
            i++;
        }
        gui.updateDisplay();
        // 
    }
}


const gui = new GUI()
guiParams = {
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
    res3_value: '',
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
    console.log("Here we go !");
    const geometry = new THREE.BufferGeometry();
    let minX = 999999999;
    let minY = 999999999;
    let maxX = 0;
    let maxY = 0;
    console.log(deptDatas);

    geojson.features.forEach(feature => {

        if (!(feature.properties.d >= deptMin && feature.properties.d <= deptMax)) {
            return;
        }

        feature.geometry.coordinates.forEach(polygon => {
            if (feature.geometry.type == 'MultiPolygon') {
                console.log("MULTI");
                polygon = polygon[0];
            }
            minX = Math.min(minX, ...polygon.map(elt => elt[0]));
            maxX = Math.max(maxX, ...polygon.map(elt => elt[0]));
            minY = Math.min(minY, ...polygon.map(elt => elt[1]));
            maxY = Math.max(maxY, ...polygon.map(elt => elt[1]));
        });
    });
    console.log("min", minX, minY);
    console.log("max", maxX, maxY);

    geojson.features.forEach(feature => {

        if (!(feature.properties.d >= deptMin && feature.properties.d <= deptMax)) {
            return;
        }
        // console.log("feature", feature);
        let coordinates = feature.geometry.coordinates;
        if (feature.geometry.type == 'MultiPolygon') {
            // console.log("MULTI");

        }
        feature.geometry.coordinates.forEach(polygon => {
            const shape = new THREE.Shape();
            // console.log("polygon", polygon);
            if (feature.geometry.type == 'MultiPolygon') {
                // console.log("MULTI");
                polygon = polygon[0];
            }
            polygon.forEach((coord, index) => {
                //console.log('ring', coord);
                let x = (coord[0] - maxX) / 1000;
                let y = (coord[1] - maxY) / 1000;
                //console.log("Coord", coord, x, y);
                if (index === 0) {
                    shape.moveTo(x, y);
                } else {
                    shape.lineTo(x, y);
                }
            });
            // const geometry = new THREE.ShapeGeometry(shape);
            // console.log(feature.properties.c);
            // console.log(deptDatas[feature.properties.c]);
            let depth = deptDatas[feature.properties.c] ? deptDatas[feature.properties.c].votants / 300 : 1;
            let color = '#000000';
            if (communes_liste_tete[feature.properties.c]) {
                let listeId = communes_liste_tete[feature.properties.c];
                let listeRealId = liste_dict[listeId].id;

                color = resultatsFE.listes.filter(liste => liste.num == listeRealId)[0].couleur;
                if (communes_liste_tete[feature.properties.c] == 6) //Les républicains : 6 > 18
                    console.log(communes_liste_tete[feature.properties.c], color, resultatsFE.listes.filter(liste => liste.num == communes_liste_tete[feature.properties.c])[0].liste);
            }
            // console.log("dept", depth);

            extrudeSettings.depth = depth;
            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            const material = new THREE.MeshStandardMaterial({ color: color, side: THREE.DoubleSide, wireframe: false });

            // const simplifiedGeometry = modifier.modify(geometry, geometry.attributes.position.count * 0.1); // Réduire à 25% des points originaux
            // const simplifiedMesh = new THREE.Mesh(simplifiedGeometry, material);

            materialShader.uniforms.objectColor.value = new THREE.Color(color);
            const mesh = new THREE.Mesh(geometry, material);
            mesh.userData.properties = feature.properties;
            meshes.push(mesh);

            // console.log(shape);

            scene.add(mesh);
        });


    });


}


