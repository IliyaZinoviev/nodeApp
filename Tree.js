const fs = require('fs');
const $rdf = require('rdflib');


const RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
const RDFS = $rdf.Namespace("http://www.w3.org/2000/01/rdf-schema#");
const FOAF = $rdf.Namespace("http://xmlns.com/foaf/0.1/");
const XSD = $rdf.Namespace("http://www.w3.org/2001/XMLSchema#");
const OWL = $rdf.Namespace("http://www.w3.org/2002/07/owl#");


const rdfData = fs.readFileSync(__dirname + '/public/uploads/ontology.xml').toString();
const contentType = 'application/rdf+xml';
const baseUrl = "http://marchenko_ilya/macroeconomics.com";
const store = $rdf.graph();
$rdf.parse(rdfData, store, baseUrl, contentType);
const prefix = store.statementsMatching(undefined, RDF('type'), OWL('Ontology'))[0].subject.value+'#';
const links = new Map([[1, 'isEqToCond'], [2, 'def'], [3, 'pair'], [4, 'eq'], [5, 'par'], [6, 'depOn'], [7, 'seq']]);
let paramURI;
let countryURI;
let yearURI;
let argURI;
let year;
let concept;
let country;
let arrConcepts=[];
let arrValues;


class Node{
    constructor(value, uri = null){
        this.value = value;
        this.uri = uri;
        this.num = undefined;
        this.l = null;
        this.r = null;
    }
}

function createTree(concept_, year_, country_, callback) {
    concept = concept_;
    year = year_;
    country = country_;
    let left_subtree = new Node(links.get(2));
    left_subtree.l = setConcept();
    setParams(function(node) {
        left_subtree.r = node;
        let root = setIsEqToCond();
        root.l = left_subtree;
        callback(root);
    });
}

function setConcept(){
    argURI = prefix + concept;
    return new Node(concept, argURI);
}

function setParams(callback){
    const sparqlQuery = `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
                         SELECT ?s WHERE { ?s <` + prefix + `состоит_из> <` + prefix + country + `>.
                         ?s <` + prefix + `состоит_из> <` + prefix + year + `> .}`;
    const query = $rdf.SPARQLToQuery(sparqlQuery, false, store);
    store.query(query, function(result) {
        paramURI = result['?s'].value;
        callback(new Node(result['?s'].value.substring(prefix.length), paramURI));
    });
}

function setIsEqToCond(){
    let arrFormula = store.statementsMatching($rdf.sym(argURI), $rdf.sym(prefix + 'вычисляется_по'), undefined);
    let node = new Node(links.get(1));
    if(arrFormula.length > 1) {
        let objParals = {
            arr: []
        };
        node.r = subtreeFormation(objParals, links.get(5), arrFormula.length, 1);
        console.log(objParals);
        for (let i = 0; i < objParals.arr.length; i++)
            if (objParals.arr[i] === null)
                objParals.arr[i - 1].r = setPair(arrFormula[i].object.value);
            else
                objParals.arr[i].l = setPair(arrFormula[i].object.value);
    } else{
        node.r = setPair(arrFormula[0].object.value);
    }
    return node;
}
function setPair(formulaURI){
    let node = new Node(links.get(3));
    arrValues = [];
    node.r = setDep(formulaURI);
    node.l = setCond();
    return node;
}

function setDep(formulaURI){
    let funUri = store.statementsMatching($rdf.sym(formulaURI), $rdf.sym(prefix + 'соответствует_отображению'), undefined)[0].object.value;
    let node = new Node(links.get(6));
    node.l = new Node(funUri.substring(prefix.length), funUri);
    let arrFormulaNum = store.statementsMatching(undefined, $rdf.sym(prefix + 'относится_к'), $rdf.sym(formulaURI))
        .sort(sortSeq);
    if(arrFormulaNum.length > 1) {
        let objSeqs = {
            arr: []
        };
        node.r = subtreeFormation(objSeqs, links.get(7), arrFormulaNum.length, 1);
        for (let i = 0; i < objSeqs.arr.length; i++)
            if (objSeqs.arr[i] === null)
                objSeqs.arr[i - 1].r = setArg(arrFormulaNum[i].subject.value);
            else
                objSeqs.arr[i].l = setArg(arrFormulaNum[i].subject.value);
    } else
        node.r = setArg(arrFormulaNum[0].subject.value);
    return node;
}

// Формирую поддерево, и храню ссылки на его листья, чтобы потом добавлять их в цикле без обхода
function subtreeFormation(obj, rel, n, i){
    if(n > 1){
        let node = new Node(rel);
        node.num = i;
        obj.arr.push(node);
        node.r = subtreeFormation(obj, rel, n-1, i+1);
        return node;
    }
    else{
        obj.arr.push(null);
        return null;
    }
}

// В качестве аргумента (переменной) могут выступать формула и понятие. Не хватает формулы!!!
function setArg(formulaNumURI){
    let argURI = store.statementsMatching($rdf.sym(formulaNumURI), $rdf.sym(prefix + 'представляет_собой'), undefined)[0]
        .object.value;
    let typeOfArg = store.statementsMatching($rdf.sym(argURI), RDF('type'), undefined, undefined)[1].object.value;
    if(getLabel(typeOfArg) === 'Формула')
        return setDep(argURI);
    else {
        if (hasValue(argURI))
            return new Node(getLabel(argURI), argURI);
        else {
            arrConcepts.push({label: getLabel(argURI), uri: argURI}); // Множество показателей, использующихся для вычисления формулы
            return setDep(store.statementsMatching($rdf.sym(argURI), $rdf.sym(prefix + 'вычисляется_по'), undefined)[0]
                .object.value);
        }
    }
}

// Если понятие имеет значение, тогда сохранить его в массив arrValues
function hasValue(conceptURI){
    let triple = store.statementsMatching(undefined, getURI('принадлежит'), $rdf.sym(conceptURI));
    if(0 !== triple.length){
        let valueURI = triple[0].subject.value;
        arrValues.push({label: getLabel(valueURI), uri: valueURI});
        return true;
    } else
        return false;
}

function setCond(){
    let node;
    if(arrValues.length > 1) {
        let objParals = {
            arr: []
        };
        node = subtreeFormation(objParals, links.get(5), arrValues.length, 1);
        for (let i = 0; i < objParals.arr.length; i++)
            if (objParals.arr[i] === null)
                objParals.arr[i - 1].r = setVal(arrValues[i]);
            else
                objParals.arr[i].l = setVal(arrValues[i]);
    } else
        node = setVal(arrValues[0]);
    return node;
}

function setVal(obj){
    let node = new Node(links.get(4));
    let value = store.statementsMatching($rdf.sym(obj.uri), getURI('Значение'), undefined)[0].object.value;
    node.l = new Node(obj.label, obj.uri);
    node.r = new Node(value);
    return node;
}

function getURI(str){
    return $rdf.sym(prefix+str);
}

function getLabel(uri){
    return uri.substring(prefix.length);
}

// Упорядочивание массива номеров формулы (Пара:Формула,ном.арг)
function sortSeq(a, b) {
    a = store.statementsMatching($rdf.sym(a.subject.value), $rdf.sym(prefix + 'Номер'), undefined);
    b = store.statementsMatching($rdf.sym(b.subject.value), $rdf.sym(prefix + 'Номер'), undefined);
    if (a > b)
        return 1;
    else
        return -1;
}

function travelsal(tree, fn, str){
    if(tree.l !== null)
        travelsal(tree.l, fn, str + '    ');
    fn(str+tree.value);
    if(tree.r !== null)
        travelsal(tree.r, fn, str + '    ');
}

let tree;

createTree('ВНП', '2017', 'Россия', function(root){
    tree = root;
    travelsal(root, console.log, '');
});

module.exports.createTree = createTree;
module.exports.Node = Node;
module.exports.travelsal = travelsal;