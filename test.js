const src = 'https://firestore.googleapis.com/v1/projects/opema-clothing/databases/(default)/documents/artifacts/default-app-id/public/data/products';
fetch(src).then(r => r.json()).then(data => {
    const id = data.documents[0].name.split('/').pop();
    console.log('ID:', id);
    fetch(src + '/' + id).then(r => r.json()).then(d => {
        console.log(JSON.stringify(d.fields, null, 2));
    });
});
