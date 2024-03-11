const cookieParser = require('cookie-parser');
const express = require('express'); 
const expressLayouts = require('express-ejs-layouts'); 
const bodyParser = require('body-parser');
const app = express();  
app.use(cookieParser());
app.use(express.json());
const port = 6789;  
const fs = require('fs');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('cumparaturi.db');

app.use(cookieParser());
app.use(session({
    secret: 'secret-key',
    resave: true,
    saveUninitialized: true,
}));

// directorul 'views' va conține fișierele .ejs (html + js executat la server) 
app.set('view engine', 'ejs'); 
// suport pentru layout-uri - implicit fișierul care reprezintă template-ul site-ului este views/layout.ejs 
app.use(expressLayouts); 
// directorul 'public' va conține toate resursele accesibile direct de către client (e.g., fișiere css, javascript, imagini) 
app.use(express.static('public')) 
// corpul mesajului poate fi interpretat ca json; datele de la formular se găsesc în format json în req.body 
app.use(bodyParser.json()); 
// utilizarea unui algoritm de deep parsing care suportă obiecte în obiecte 
app.use(bodyParser.urlencoded({ extended: true }));  

app.use((req, res, next) => {
    res.locals.autentificat = req.session.utilizator !== undefined;
    res.locals.utilizator = req.session.utilizator;
    next();
});

// la accesarea din browser adresei http://localhost:6789/ se va returna textul 'Hello World' 
// proprietățile obiectului Request - req - https://expressjs.com/en/api.html#req 
// proprietățile obiectului Response - res - https://expressjs.com/en/api.html#res 
app.get('/', (req, res) => {     
    const username = req.cookies.username; // Obțineți valoarea cookie-ului 'utilizator'
    const role = req.cookies.role;
    //res.render('index', { username }); // Pasați valoarea cookie-ului către view-ul 'index.ejs'

    db.all('SELECT * FROM produse', (err, rows) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Internal Server Error');
            }

            console.log(rows);

            res.render('index', { username, produse: rows, autentificat: true, role: role, cos: req.session.cos });
        });
}); 

// la accesarea din browser adresei http://localhost:6789/chestionar se va apela funcția specificată 
app.get('/chestionar', (req, res) => {     
    fs.readFile('intrebari.json', 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
            return;
        }
    
        const intrebari = JSON.parse(data);
    
        res.render('chestionar', { intrebari: intrebari });
    });
// în fișierul views/chestionar.ejs este accesibilă variabila 'intrebari' care conține vectorul de întrebări     
}); 

app.post('/rezultat-chestionar', (req, res) => {
    fs.readFile('intrebari.json', 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
            return;
        }
    
        const intrebari = JSON.parse(data);
        
        const raspunsuriCorecte = intrebari.map(intrebare => intrebare.raspunsCorect);
        let numarRaspunsuriCorecte = 0;

    for (let i = 0; i < raspunsuriCorecte.length; i++) {
        const raspunsCorect = raspunsuriCorecte[i];
        const raspunsPrimit = req.body['q' + i];
        
        if (raspunsCorect === raspunsPrimit) {
            numarRaspunsuriCorecte++;
        }
    }

    res.render('rezultat-chestionar', { numarRaspunsuriCorecte: numarRaspunsuriCorecte });
    });
});

app.get('/autentificare', (req, res) => {
    const mesajEroare = req.cookies.mesajEroare;

    res.render('autentificare', { mesajEroare });
});

function verificareUtilizator(username, password)
{
    // Citirea conținutului fișierului utilizatori.json
    const utilizatoriAutorizati = JSON.parse(fs.readFileSync('./json/utilizatori.json', 'utf-8'));

    var isValid = -1;
    utilizatoriAutorizati.forEach((element) => {
        const u = element.username;
        const p = element.password;

        if (u === username && p === password)
        {
            const r = element.role;
            if (r == "ADMIN")
            {
                isValid = 0;
            }
            else if (r == "USER")
            {
                isValid = 1;
            }
        }
    });

    return isValid;
}

app.post('/verificare-autentificare', (req, res) => {
    console.log(req.body);
    const { username, password } = req.body;
    
    // Verificare utilizator și parolă
    var raspuns = verificareUtilizator(username, password);
    if (raspuns != -1) 
    { 
        // Autentificare corectă
        console.log("raspuns bun");
        req.session.username = username;
        if (raspuns == 0)
        {
            req.session.role = "ADMIN";
            res.cookie ('role', "ADMIN");
        }
        else 
        {
            req.session.role = "USER";
            res.cookie ('role', "USER");
        }
        
        req.session.loggedIn = true;
        res.cookie('username', username);
        res.redirect('/'); // Redirecționarea către http://localhost:6789/
    }
    else 
    {
        // Autentificare incorectă

        console.log("esuat");
        req.session.mesajEroare = 'Nume de utilizator sau parolă incorecte';
        res.cookie('mesajEroare', req.session.mesajEroare, { maxAge: 3000 }); // Setarea unui cookie cu numele mesajEroare
        res.redirect('/autentificare'); // Redirecționarea către http://localhost:6789/autentificare
    }
});

app.get('/delogare', (req, res) => {
    req.session.destroy((err) => {
        if (err) 
        {
            console.error('Eroare la delogare:', err);
        }
        //const { username} = req.body;
        res.clearCookie('username');
        res.redirect('/');
    });
});

app.get('/creare-bd', (req, res) => {
    const db = new sqlite3.Database('cumparaturi.db');

    // Creați tabela "produse" în baza de date "cumparaturi"
    db.serialize(() => {
        db.run('CREATE TABLE IF NOT EXISTS produse (id INTEGER PRIMARY KEY AUTOINCREMENT, nume TEXT, pret REAL)');

        db.close();

        // Redirecționați clientul către resursa "/"
        res.redirect('/');
    });
});

app.get('/inserare-bd', (req, res) => {
    const db = new sqlite3.Database('cumparaturi.db');

    // Array cu produsele de inserat 
    const data = fs.readFileSync('./json/produse.json', 'utf-8');
    const produse = JSON.parse(data);

    // Inserare produse în tabela "produse"
    db.serialize(() => {
        const stmt = db.prepare('INSERT INTO produse (nume, pret) VALUES (?, ?)');

        for (const produs of produse) {
            stmt.run(produs.nume, produs.pret);
        }

    stmt.finalize();

    db.close();

      // Redirecționare către resursa "/"
    res.redirect('/');
    });
});

app.post('/adaugare_cos', (req, res) => {
    if (req.session.produse)
    {
        //console.log(req.body['id'] + " in if")
        req.session.produse[req.session.produse.length] = req.body['id'];
        console.log (req.session.produse);
        res.redirect('/');
    }
    else
    {
        //console.log(req.body['id'] + " in else")
        req.session.produse = [];
        req.session.produse [req.session.produse.length] = req.body['id'];
        console.log (req.session.produse);
        res.redirect('/');
    }
});

app.get('/vizualizare_cos', (req, res) => {
    db.serialize (()=> {
        const p = db.prepare ('SELECT * FROM produse;');
        p.all((err, rows) => {
            if (err)
            {
                console.log (err);
            }

            let cos = []; // Accesați vectorul de produse din coșul de cumpărături din variabila de sesiune
        
            rows.forEach(row => {
                if (req.session.produse)
                {
                    console.log(req.session.produse + "  "+ row.id)
                    if (req.session.produse.includes(String(row.id)))
                    {
                        
                        cos[cos.length] = row;
                    }
                }
            });
            res.render('vizualizare-cos', { cosCumparaturi:cos }); // Renderează fișierul vizualizare-cos.ejs și transmite datele coșului de cumpărături
        });
    });
});

const requireAdmin = (req, res, next) => {
    console.log (req.session.role);
    if (req.session.loggedIn && req.session.role === 'ADMIN') {
      next(); // Permitem accesul către ruta protejată pentru administrator
    } else {
      res.redirect('/autentificare'); // Redirecționăm utilizatorul către pagina de autentificare
    }
};

app.get('/admin', requireAdmin, (req, res) => {
    res.render('admin'); 
});

app.post('/admin/adaugare-produs', requireAdmin, (req, res) => {
    // Obțineți datele produsului din corpul cererii
    const nume = req.body.nume_produs;
    const pret = req.body.pret;
    console.log (nume);

    // Validați datele produsului
    if (!nume || !pret) {
        res.status(400).send('Numele și prețul produsului sunt obligatorii.');
        return;
    }

    // Adăugați produsul în baza de date
    const query = 'INSERT INTO produse (nume, pret) VALUES (?, ?)';
    const values = [nume, pret];

    db.run(query, values, function (error) {
    if (error) {
        console.error('Eroare la inserarea produsului:', error);
        res.status(500).send('A apărut o eroare în timpul adăugării produsului.');
        return;
    }
    //res.send('Produs adaugat cu succes');
    console.log("Produs adaugat cu succes");
      // Produsul a fost adăugat cu succes
    res.redirect('/admin');
    });
});

app.listen(port, () => console.log(`Serverul rulează la adresa http://localhost:`));