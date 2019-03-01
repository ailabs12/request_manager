// *****************Зависимости *****************//
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');

// ***************** Константы *****************//
const host = 'http://82.202.249.143';
const detectors = {
    'Object detector (Keras)': `${host}:8001/ssd`,
    'Object detector (OpenCV)': `${host}:8002`,
    'Face detector (OpenCV)': `${host}:8002`,
};

const classifiers = {
    'Emotion classifier 1.0': `${host}:8003/emotion/1.0`,
    'Gender classifier 1.0': `${host}:8003/gender/1.0`,
    'Age classifier 1.0': `${host}:8003/age/1.0`,

    'Gender classifier 2.0': `${host}:8003/gender/2.0`,
    'Age classifier 2.0': `${host}:8003/age/2.0`,

    'Car classifier': `${host}:8004/bicars`,
};

const carClassifiers = ['Car classifier'];
const ratioClassifiers = {
    'лицо': [
        'Emotion classifier 1.0', 
        'Gender classifier 1.0', 
        'Age classifier 1.0',

        'Gender classifier 2.0',
        'Age classifier 2.0'
    ],

    'автомобиль': carClassifiers,
    'грузовая машина': carClassifiers,
    'автобус': carClassifiers,
    'поезд': carClassifiers,

    'car': carClassifiers,
    'train': carClassifiers,
    'truck': carClassifiers,
    'bus': carClassifiers
};


// ************************ express ************************
let app = express(); 

app.use(
    bodyParser.json({
    limit: '10mb', 
    extended: true
}));

app.use(
    bodyParser.urlencoded({
        limit: '10mb', 
        extended: true
    })
);

app.use(bodyParser.json()); 



app.all('/', async (req, res) => {
    console.log('new http request');
    try {
        var request = JSON.parse( JSON.stringify(req.body) );

        if (!request['image']) {
            return res.send('Not found image');
        }
        if (!request['detector'] || !detectors[ request['detector'] ] ) {
            return res.send('Not found detector');
        }
        // console.log('request[detector]', request['detector']);
        getObjects(request, res);
    } catch (err) {
        console.warn(err);
        res.send('Invalid json');
    }
}); 

app.listen(8009, function() {
    console.log('Listen port 8009');
});

// ************************ Сбор информации ************************

async function getObjects(req, res) {
    let image = req.image;
    let selectedClassifiers = {};

    if ( ('classifiers' in req) && (Array.isArray(req.classifiers) ) ) {

        req.classifiers.forEach( (item, i, arr) => {
            if (classifiers[item]) {
                selectedClassifiers[item] = 1;
            }
        });
    }

    try {
        var detectorData = await sendRequest({
            uri: detectors[req.detector],
            method: 'POST',
            json: {
              "image": JSON.stringify(image)
            }
        });

        // console.log('detectorData', detectorData);

        if (!detectorData || !detectorData.success && !detectorData.data) {
            throw 'The detector response does not contain a success field';
        }
        if (!detectorData || !detectorData.data) {
            throw 'The response of the detector does not contain a data field';
        }
    } catch (err) {
        console.error('RESPONSE ON REQUEST detectorData error', err);
        return res.send(err);
    }

    let promises = [];
    for (key in detectorData.data) {
        if ('class' in detectorData.data[key]) {
            let curClass = detectorData.data[key].class;

            if (ratioClassifiers[curClass]) {
                let services = ratioClassifiers[curClass];
                if (services && services.length) {

                    services.forEach((item, i, arr) => {
                        // console.log('item', item);

                        if (!selectedClassifiers[item]) return;

                        promises.push(
                            sendRequest({
                                uri: classifiers[item],
                                method: 'POST',
                                json: {
                                    "image": detectorData.data[key].image
                                }
                            }, 
                            detectorData.data[key], 
                            item)
                        );
                    });
                }
            }
        }
    }

    Promise.all(promises).then(value => {
        for (let key in detectorData.data) {
            //delete detectorData.data[key].image;
        }
        res.send(detectorData);
    }, reason => {
        console.error('Ошибка при сборе информации с классификаторов', reason);
        res.send(detectorData);
    });
}

async function sendRequest(req, parent, service) {
    return new Promise((resolve, reject) => {
        request(req, (err, res, data) => {
            if (err) {
                console.error(`sendRequest err: ${err}`);
                return reject(err);
            }
            if (res.statusCode != 200) {
                console.error(`sendRequest statusCode: ${res.statusCode}`);
                return reject(`sendRequest statusCode: ${res.statusCode}`);
            }
            if ( data && (typeof data == 'object') && ('success' in data) && 
                data.success && ('data' in data) && (typeof data['data'] == 'object') ) {
                    if (parent && service) {
                        parent[service] = data;
                    }
                return resolve(data);
            } else {
                return reject(data);
            }
        });
    });
}




// ***************** Логика *****************//
// const nodeBase64image = require('node-base64-image');
// nodeBase64image.encode('family.jpg', { string: true, local: true }, async (err, image) => {
//     if (err) {
//         return console.error(`nodeBase64image.encode err: ${err}`);
//     }

//     if (!image) {
//         throw new Error('Нет b64 изображения data', image);
//     }

//     try {
//         var detectorData = await sendRequest({
//             uri: detectors['Object detector (OpenCV)'],
//             method: 'POST',
//             json: {
//               "image": 'data:image/jpeg;base64,' + image
//             }
//         });

//         console.log('detectorData', detectorData);

//         if (!detectorData || !detectorData.success && !detectorData.data) {
//             throw 'The detector response does not contain a success field';
//         }
//         if (!detectorData || !detectorData.data) {
//             throw 'The response of the detector does not contain a data field';
//         }
        
//     } catch (err) {
//         return console.error('RESPONSE ON REQUEST detectorData error', err);
//     }

//     let promises = [];
//     for (key in detectorData.data) {
//         if ('class' in detectorData.data[key]) {
//             let curClass = detectorData.data[key].class;
//             console.log('');

//             if (ratioClassifiers[curClass]) {
//                 let services = ratioClassifiers[curClass];
//                 if (services && services.length) {
//                     console.log(curClass, services);

//                     services.forEach((item, i, arr) => {
//                         // console.log(classifiers[item]);
//                         // console.log(detectorData.data[key].image);

//                         promises.push(
//                             sendRequest({
//                                 uri: classifiers[item],
//                                 method: 'POST',
//                                 json: {
//                                 "image": 'data:image/jpeg;base64,' + image
//                                 }
//                             }, 
//                             detectorData.data[key], 
//                             item)
//                         );
//                     });
//                 }
//             } else {
//                 console.log(curClass, 'не имеет классификаторов');
//             }
//         }
//     }

//     Promise.all(promises).then(value => { 
//         console.log('response', detectorData);
//     }, reason => {
//         console.error('reason', reason);
//         console.log('response', detectorData);
//     });
// });

// async function sendRequest(req, parent, service) {
//     return new Promise((resolve, reject) => {
//         request(req, (err, res, data) => {
//             if (err) {
//                 console.error(`sendRequest err: ${err}`);
//                 return reject(err);
//             }
//             if (res.statusCode != 200) {
//                 console.error(`sendRequest statusCode: ${res.statusCode}`);
//                 return reject(`sendRequest statusCode: ${res.statusCode}`);
//             }
//             if ( data && (typeof data == 'object') && ('success' in data) && 
//                 data.success && ('data' in data) && (typeof data['data'] == 'object') ) {
//                     if (parent && service) {
//                         parent[service] = data;
//                     }
//                 return resolve(data);
//             } else {
//                 return reject(data);
//             }
//         });
//     });
// }