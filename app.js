const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const express = require('express');
const bodyParser = require('body-parser');
const multer  = require('multer');
const genTree = require('./Tree.js');

// Объявление дерева
let tree;

// Дерево передаётся в виде текстового файла в представление print
let obj;

// Init app, parsers, view engine
const jsonParser = bodyParser.json();
const urlencodedParser = bodyParser.urlencoded({extended: false});
const app = express();

// Установка движка хранилища
const storage = multer.diskStorage({
    destination: './public/uploads',
    filename: function (req, file, cb) {
        cb(null, 'ontology' + path.extname(file.originalname))
    }
});

// Инициализация загрузчика
const upload = multer({
    storage: storage,
    limits:{fileSize: 20000000}, // Разрешёный размер файла не больше 20мб
    fileFilter: (req, file, cb) => {
        checkFileType(file, cb)
    }
}).single('ontology');

// Check File Type
function checkFileType(file, cb){
    // Допустимые расширения
    const fileTypes = /xml$/;
    // Проверка расширения
    const extName = fileTypes.test(path.extname(file.originalname).toLowerCase());
    // // Проверка MIME
    const mimeType = fileTypes.test(file.mimetype);
    if(mimeType && extName){
        return cb(null, true);
    } else{
      cb('Ошибка: Допускаются файлы с расширением xml!')
    }
}

// Установка движка представлений ejs
app.set('view engine', 'ejs');

app.use(express.static(__dirname + "/public"));

app.get('/', (req, res) => res.render('index'));

app.get('/input', (req, res) => res.render('input'));

app.get('/print', (req, res) =>
    res.render('print', {
                            tree: obj,})
);

app.post('/upload', (req, res) => {
    upload(req, res, (err) => {
        if(err) {
            res.render('index', {
                msg: err
            });
        } else {
            if(req.file === undefined){
                res.render('index', {
                    msg: 'Ошибка: Выберите файл!'
                });
            } else {
                res.redirect('/input');
            }
        }
    });
});

app.post('/getParameters', urlencodedParser, (req, res) => {
    if (!req.body)
        return res.sendStatus(400);
    console.log(req.body);
    obj = {arr: []};
    genTree.createTree(req.body.index, req.body.year, req.body.country, function (root) {
        tree = root;
        genTree.travelsal(tree, function (x) {
            obj.arr.push(x)
        }, '');
        console.log(obj);
        res.redirect('/print');
    });
});

const port = 3000;

app.listen(port, () => console.log(`server started on port ${port}`));