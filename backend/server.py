from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import httpx
from bs4 import BeautifulSoup
import re
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============= Models =============

class Scripture(BaseModel):
    reference: str  # e.g., "Giovanni 3:16"
    text: Optional[str] = None
    url: Optional[str] = None

class Presentation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    intro: str  # How to start the conversation
    main_points: List[str] = []  # Main discussion points
    questions: List[str] = []  # Questions to ask
    scriptures: List[Scripture] = []  # Bible scriptures
    objections: List[dict] = []  # Common objections and responses
    topic: Optional[str] = None  # Topic/theme
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_ai_generated: bool = False

class PresentationCreate(BaseModel):
    title: str
    intro: str
    main_points: List[str] = []
    questions: List[str] = []
    scriptures: List[Scripture] = []
    objections: List[dict] = []
    topic: Optional[str] = None

class PresentationUpdate(BaseModel):
    title: Optional[str] = None
    intro: Optional[str] = None
    main_points: Optional[List[str]] = None
    questions: Optional[List[str]] = None
    scriptures: Optional[List[Scripture]] = None
    objections: Optional[List[dict]] = None
    topic: Optional[str] = None

class GenerateRequest(BaseModel):
    topic: Optional[str] = None
    news_context: Optional[str] = None
    location: Optional[str] = None

class NewsResponse(BaseModel):
    title: str
    description: str
    source: str
    url: Optional[str] = None

# ============= Helper Functions =============

# Database locale delle scritture bibliche più comuni (Traduzione del Nuovo Mondo)
SCRIPTURES_DB = {
    # Genesi
    "genesi 1:1": "In principio Dio creò i cieli e la terra.",
    "genesi 1:27": "E Dio creò l'uomo a sua immagine; lo creò a immagine di Dio; li creò maschio e femmina.",
    "genesi 1:28": "Dio li benedisse, e Dio disse loro: "Siate fecondi e moltiplicatevi, riempite la terra e soggiogatela; tenete sottoposti i pesci del mare, le creature volatili dei cieli e ogni essere vivente che si muove sulla terra".",
    "genesi 2:24": "Perciò l'uomo lascerà suo padre e sua madre e si unirà a sua moglie, e i due diventeranno una sola carne.",
    "genesi 3:15": "E porrò inimicizia fra te e la donna, e fra il tuo seme e il suo seme. Esso ti schiaccerà la testa, e tu lo colpirai al calcagno".",
    
    # Esodo
    "esodo 20:12": "Onora tuo padre e tua madre, perché i tuoi giorni siano lunghi sulla terra che Geova tuo Dio ti dà.",
    
    # Salmi
    "salmi 23:1": "Geova è il mio Pastore. Non mi mancherà nulla.",
    "salmi 23:4": "Anche se cammino nella valle dell'ombra della morte, non temo nessun male, perché tu sei con me; il tuo bastone e la tua verga mi confortano.",
    "salmi 37:9": "Poiché i malfattori saranno stroncati, ma quelli che sperano in Geova erediteranno la terra.",
    "salmi 37:10": "Ancora un po' e il malvagio non ci sarà più; cercherai il suo posto, ma lui non ci sarà.",
    "salmi 37:11": "Ma i mansueti erediteranno la terra e proveranno immensa gioia nella pace abbondante.",
    "salmi 37:29": "I giusti erediteranno la terra e vi abiteranno per sempre.",
    "salmi 34:17": "Essi gridano, e Geova ode; li libera da tutte le loro angustie.",
    "salmi 34:18": "Geova è vicino a chi ha il cuore affranto; salva chi è depresso.",
    "salmi 34:19": "Molte sono le calamità del giusto, ma Geova lo libera da tutte.",
    "salmi 46:1": "Dio è per noi rifugio e forza, un aiuto che si trova prontamente nei momenti di angoscia.",
    "salmi 55:22": "Getta il tuo peso su Geova, ed egli ti sosterrà. Mai permetterà che il giusto vacilli.",
    "salmi 83:18": "Affinché conoscano che tu, il cui nome è Geova, tu solo sei l'Altissimo su tutta la terra.",
    "salmi 104:5": "Ha fondato la terra sulle sue basi; non sarà mai smossa.",
    "salmi 115:16": "I cieli appartengono a Geova, ma la terra l'ha data ai figli degli uomini.",
    "salmi 145:16": "Apri la tua mano e soddisfi il desiderio di ogni essere vivente.",
    "salmi 146:3": "Non riponete fiducia nei nobili, né nel figlio dell'uomo, che non può dare salvezza.",
    "salmi 146:4": "Il suo spirito se ne va, ed egli torna alla polvere; in quello stesso giorno i suoi pensieri periscono.",
    
    # Proverbi
    "proverbi 3:5": "Confida in Geova con tutto il tuo cuore e non ti appoggiare al tuo proprio intendimento.",
    "proverbi 3:6": "Riconoscilo in tutte le tue vie, ed egli renderà diritti i tuoi sentieri.",
    "proverbi 22:6": "Addestra il ragazzo secondo la via per lui; anche quando invecchierà non se ne allontanerà.",
    
    # Ecclesiaste
    "ecclesiaste 9:5": "I viventi infatti sanno che moriranno, ma i morti non sanno nulla, né hanno più alcuna ricompensa, perché il ricordo di loro è stato dimenticato.",
    "ecclesiaste 9:10": "Tutto ciò che la tua mano trova da fare, fallo con tutta la tua forza, perché non c'è né opera né progetto né conoscenza né sapienza nello Sceol, il luogo verso cui stai andando.",
    
    # Isaia
    "isaia 9:6": "Poiché un bambino ci è nato, un figlio ci è stato dato; e il dominio principesco sarà sulle sue spalle. E sarà chiamato col nome di Consigliere meraviglioso, Dio potente, Padre eterno, Principe della pace.",
    "isaia 11:6": "E il lupo risiederà con l'agnello, e il leopardo giacerà col capretto, e il vitello e il giovane leone e l'animale ingrassato staranno tutti insieme; e un ragazzino li guiderà.",
    "isaia 11:9": "Non faranno danno né causeranno rovina in tutto il mio monte santo, perché la terra sarà certamente piena della conoscenza di Geova come le acque ricoprono il mare.",
    "isaia 25:8": "Egli inghiottirà la morte per sempre, e il Sovrano Signore Geova asciugherà le lacrime da ogni viso.",
    "isaia 33:24": "E nessun residente dirà: "Sono malato".",
    "isaia 35:5": "In quel tempo gli occhi dei ciechi saranno aperti e gli orecchi dei sordi saranno sturati.",
    "isaia 35:6": "In quel tempo lo zoppo salterà come il cervo e la lingua del muto griderà di gioia.",
    "isaia 40:26": "Alzate gli occhi in alto e vedete. Chi ha creato queste cose? Colui che fa uscire il loro esercito a schiere, che le chiama tutte per nome.",
    "isaia 40:31": "Ma quelli che sperano in Geova riacquisteranno forza. Saliranno con ali come aquile. Correranno e non si stancheranno; cammineranno e non si affaticheranno.",
    "isaia 41:10": "Non aver paura, perché io sono con te. Non guardarti intorno smarrito, perché io sono il tuo Dio. Ti fortificherò, sì, ti aiuterò, sì, ti sosterrò con la mia destra di giustizia.",
    "isaia 41:13": "Poiché io, Geova tuo Dio, afferro la tua destra, io che ti dico: 'Non aver paura. Io stesso ti aiuterò'.",
    "isaia 43:10": ""Voi siete i miei testimoni", dichiara Geova, "il mio servitore che ho scelto, affinché conosciate e abbiate fede in me, e capiate che io sono lo stesso. Prima di me non fu formato nessun Dio, e dopo di me non ce ne fu nessuno."",
    "isaia 48:17": "Così dice Geova, il tuo Redentore, il Santo d'Israele: "Io, Geova, sono il tuo Dio, Colui che ti insegna per il tuo bene, Colui che ti guida nella via in cui devi camminare."",
    "isaia 55:11": "Così sarà la mia parola che esce dalla mia bocca. Non tornerà a me senza risultati, ma certamente farà ciò che mi compiace e avrà sicuro successo in ciò per cui l'ho mandata.",
    "isaia 65:17": "Poiché, ecco, creo nuovi cieli e una nuova terra; e le cose precedenti non saranno ricordate né verranno in mente.",
    "isaia 65:21": "Edificheranno case e le abiteranno; pianteranno vigne e ne mangeranno il frutto.",
    "isaia 65:22": "Non edificheranno perché un altro abiti, né pianteranno perché un altro mangi.",
    "isaia 65:25": "Il lupo e l'agnello pascoleranno insieme; il leone mangerà paglia come il toro; e il serpente avrà la polvere per cibo. Non faranno alcun danno né causeranno alcuna rovina in tutto il mio monte santo", dice Geova.",
    
    # Geremia
    "geremia 10:23": "So bene, o Geova, che non spetta all'uomo terreno dirigere i propri passi.",
    "geremia 29:11": "'Poiché io conosco i pensieri che penso riguardo a voi', dichiara Geova, 'pensieri di pace e non di calamità, per darvi un futuro e una speranza.'",
    
    # Ezechiele
    "ezechiele 18:4": "Ecco, tutte le anime appartengono a me. Come l'anima del padre, così l'anima del figlio appartiene a me. L'anima che pecca, essa stessa morirà.",
    
    # Daniele
    "daniele 2:44": "Ai giorni di quei re il Dio del cielo stabilirà un regno che non sarà mai distrutto. E quel regno non passerà ad alcun altro popolo. Stritolerà tutti questi regni e vi porrà fine, ed esso stesso sussisterà a tempo indefinito.",
    
    # Michea
    "michea 4:4": "E siederanno, ciascuno sotto la sua vite e sotto il suo fico, e non ci sarà nessuno che li faccia tremare.",
    
    # Matteo
    "matteo 4:4": "Ma egli rispose: "È scritto: 'L'uomo non deve vivere di solo pane, ma di ogni parola che esce dalla bocca di Geova'".",
    "matteo 5:5": "Felici i miti, perché erediteranno la terra.",
    "matteo 6:9": "Voi dunque pregate così: 'Padre nostro che sei nei cieli, sia santificato il tuo nome.",
    "matteo 6:10": "Venga il tuo Regno. Si faccia la tua volontà, come in cielo, così sulla terra.",
    "matteo 6:33": "Continuate dunque a cercare prima il Regno e la sua giustizia, e tutte queste altre cose vi saranno aggiunte.",
    "matteo 6:34": "Quindi non siate mai ansiosi per il domani, poiché il domani avrà le sue ansietà. A ciascun giorno basta la sua pena.",
    "matteo 7:7": "Continuate a chiedere e vi sarà dato; continuate a cercare e troverete; continuate a bussare e vi sarà aperto.",
    "matteo 7:12": "Perciò, tutte le cose che volete che gli uomini facciano a voi, anche voi dovete farle a loro.",
    "matteo 11:28": "Venite a me, voi tutti che siete affaticati e oppressi, e io vi ristorerò.",
    "matteo 11:29": "Prendete su di voi il mio giogo e imparate da me, perché io sono mite e umile di cuore, e troverete ristoro per voi stessi.",
    "matteo 22:37": "Gli disse: "'Devi amare Geova tuo Dio con tutto il tuo cuore, con tutta la tua anima e con tutta la tua mente'.",
    "matteo 22:39": "Il secondo, simile a questo, è: 'Devi amare il tuo prossimo come te stesso'.",
    "matteo 24:14": "E questa buona notizia del Regno sarà predicata in tutta la terra abitata, in testimonianza a tutte le nazioni, e allora verrà la fine.",
    "matteo 28:19": "Andate dunque e fate discepoli di persone di tutte le nazioni, battezzandole nel nome del Padre e del Figlio e dello spirito santo.",
    "matteo 28:20": "insegnando loro a osservare tutte le cose che vi ho comandato. Ed ecco, io sono con voi tutti i giorni fino al termine del sistema di cose".",
    
    # Marco
    "marco 12:30": "E devi amare Geova tuo Dio con tutto il tuo cuore, con tutta la tua anima, con tutta la tua mente e con tutta la tua forza'.",
    
    # Luca
    "luca 23:43": "E lui gli disse: "In verità ti dico oggi: tu sarai con me in Paradiso".",
    
    # Giovanni
    "giovanni 3:16": "Poiché Dio ha tanto amato il mondo che ha dato il suo Figlio unigenito, affinché chiunque esercita fede in lui non sia distrutto ma abbia vita eterna.",
    "giovanni 5:28": "Non vi meravigliate di questo, perché viene l'ora in cui tutti quelli che sono nelle tombe commemorative udranno la sua voce",
    "giovanni 5:29": "e ne usciranno: quelli che hanno fatto cose buone, a una risurrezione di vita; quelli che hanno praticato cose spregevoli, a una risurrezione di giudizio.",
    "giovanni 13:34": "Vi do un nuovo comandamento: che vi amiate gli uni gli altri; come io vi ho amato, anche voi amatevi gli uni gli altri.",
    "giovanni 13:35": "Da questo tutti conosceranno che siete miei discepoli: se avrete amore fra voi".",
    "giovanni 14:6": "Gesù gli disse: "Io sono la via, la verità e la vita. Nessuno viene al Padre se non per mezzo di me.",
    "giovanni 17:3": "Questo significa vita eterna: che conoscano te, il solo vero Dio, e colui che tu hai mandato, Gesù Cristo.",
    
    # Atti
    "atti 1:8": "Ma riceverete potenza quando lo spirito santo sarà arrivato su di voi, e mi sarete testimoni a Gerusalemme, in tutta la Giudea e la Samaria, e fino alla più distante parte della terra".",
    "atti 5:29": "In risposta Pietro e gli altri apostoli dissero: "Dobbiamo ubbidire a Dio come nostro governante anziché agli uomini.",
    "atti 17:24": "Il Dio che ha fatto il mondo e tutte le cose che sono in esso, essendo Signore del cielo e della terra, non dimora in templi fatti con mani.",
    "atti 24:15": "E ho speranza in Dio, speranza che questi uomini pure nutrono, che ci sarà una risurrezione sia dei giusti che degli ingiusti.",
    
    # Romani
    "romani 5:12": "Ecco perché, come per mezzo di un solo uomo il peccato è entrato nel mondo, e per mezzo del peccato la morte, e così la morte si è estesa a tutti gli uomini perché tutti hanno peccato.",
    "romani 6:23": "Poiché il salario che il peccato paga è la morte, ma il dono che Dio dà è la vita eterna mediante Cristo Gesù nostro Signore.",
    "romani 10:13": "Poiché "chiunque invocherà il nome di Geova sarà salvato".",
    "romani 10:14": "Comunque, come invocheranno colui nel quale non hanno riposto fede? E come riporranno fede in colui del quale non hanno udito? E come udranno senza qualcuno che predichi?",
    "romani 12:12": "Rallegratevi nella speranza. Perseverate nella tribolazione. Perseverate nella preghiera.",
    "romani 15:4": "Poiché tutte le cose che furono scritte nel passato furono scritte per nostra istruzione, affinché per mezzo della nostra perseveranza e per mezzo del conforto delle Scritture avessimo speranza.",
    
    # 1 Corinti
    "1 corinti 15:26": "E l'ultimo nemico che sarà eliminato è la morte.",
    
    # 2 Corinti
    "2 corinti 1:3": "Benedetto sia l'Iddio e Padre del nostro Signore Gesù Cristo, il Padre delle tenere misericordie e l'Iddio di ogni conforto.",
    "2 corinti 1:4": "che ci conforta in tutta la nostra tribolazione, affinché possiamo confortare quelli che sono in qualsiasi tribolazione, mediante il conforto con cui noi stessi siamo confortati da Dio.",
    
    # Galati
    "galati 5:22": "D'altra parte, il frutto dello spirito è amore, gioia, pace, pazienza, benignità, bontà, fede,",
    "galati 5:23": "mitezza, padronanza di sé. Contro tali cose non c'è legge.",
    
    # Efesini
    "efesini 6:1": "Figli, ubbidite ai vostri genitori in unione col Signore, perché questo è giusto.",
    
    # Filippesi
    "filippesi 4:6": "Non siate ansiosi di nulla, ma in ogni cosa, con preghiera e supplicazione insieme a rendimento di grazie, le vostre richieste siano rese note a Dio.",
    "filippesi 4:7": "E la pace di Dio, che sorpassa ogni pensiero, custodirà i vostri cuori e le vostre facoltà mentali mediante Cristo Gesù.",
    "filippesi 4:13": "Per ogni cosa ho forza in virtù di colui che mi impartisce potenza.",
    
    # 2 Timoteo
    "2 timoteo 3:1": "Ma sappi questo: negli ultimi giorni ci saranno tempi difficili.",
    "2 timoteo 3:16": "Tutta la Scrittura è ispirata da Dio e utile per insegnare, per riprendere, per correggere, per disciplinare nella giustizia.",
    "2 timoteo 3:17": "affinché l'uomo di Dio sia pienamente competente, completamente equipaggiato per ogni opera buona.",
    
    # Ebrei
    "ebrei 10:24": "E consideriamoci gli uni gli altri per incitarci all'amore e alle opere eccellenti,",
    "ebrei 10:25": "non abbandonando la nostra comune adunanza, come alcuni usano fare, ma esortandoci gli uni gli altri, e tanto più in quanto vedete avvicinarsi il giorno.",
    "ebrei 11:1": "La fede è la sicura aspettazione di cose sperate, l'evidente dimostrazione di cose che non si vedono.",
    
    # Giacomo
    "giacomo 1:5": "Se dunque qualcuno di voi manca di sapienza, continui a chiederla a Dio, poiché egli dà a tutti generosamente e senza rimproverare, e gli sarà data.",
    "giacomo 2:26": "Sì, come il corpo senza spirito è morto, così anche la fede senza opere è morta.",
    "giacomo 4:8": "Accostatevi a Dio, ed egli si accosterà a voi.",
    
    # 1 Pietro
    "1 pietro 3:15": "Ma santificate il Cristo come Signore nel vostro cuore, sempre pronti a fare una difesa davanti a chiunque vi chieda ragione della speranza che è in voi, ma fatelo con mitezza e profondo rispetto.",
    "1 pietro 5:7": "gettando su di lui tutta la vostra ansietà, perché egli ha cura di voi.",
    
    # 1 Giovanni
    "1 giovanni 4:8": "Chi non ama non ha conosciuto Dio, perché Dio è amore.",
    "1 giovanni 5:3": "Poiché questo è ciò che l'amore di Dio significa: che osserviamo i suoi comandamenti; e i suoi comandamenti non sono gravosi.",
    
    # Rivelazione (Apocalisse)
    "rivelazione 4:11": ""Degno sei, Geova, sì, Dio nostro, di ricevere la gloria, l'onore e la potenza, perché tu hai creato tutte le cose, e per tua volontà esistettero e furono create".",
    "rivelazione 21:3": "Con ciò udii una voce forte dal trono dire: "Ecco, la tenda di Dio è con gli uomini, ed egli risiederà con loro, ed essi saranno suoi popoli. E Dio stesso sarà con loro.",
    "rivelazione 21:4": "E asciugherà ogni lacrima dai loro occhi, e la morte non ci sarà più, né ci sarà più lutto né lamento né dolore. Le cose di prima sono passate".",
    "apocalisse 4:11": ""Degno sei, Geova, sì, Dio nostro, di ricevere la gloria, l'onore e la potenza, perché tu hai creato tutte le cose, e per tua volontà esistettero e furono create".",
    "apocalisse 21:3": "Con ciò udii una voce forte dal trono dire: "Ecco, la tenda di Dio è con gli uomini, ed egli risiederà con loro, ed essi saranno suoi popoli. E Dio stesso sarà con loro.",
    "apocalisse 21:4": "E asciugherà ogni lacrima dai loro occhi, e la morte non ci sarà più, né ci sarà più lutto né lamento né dolore. Le cose di prima sono passate".",
}

def get_scripture_from_local_db(reference: str) -> Optional[str]:
    """Get scripture text from local database"""
    ref_lower = reference.lower().strip()
    
    # Try exact match
    if ref_lower in SCRIPTURES_DB:
        return SCRIPTURES_DB[ref_lower]
    
    # Try with variations (rivelazione/apocalisse)
    ref_variations = [ref_lower]
    if ref_lower.startswith("apocalisse"):
        ref_variations.append(ref_lower.replace("apocalisse", "rivelazione"))
    elif ref_lower.startswith("rivelazione"):
        ref_variations.append(ref_lower.replace("rivelazione", "apocalisse"))
    
    for ref in ref_variations:
        if ref in SCRIPTURES_DB:
            return SCRIPTURES_DB[ref]
    
    # Try to match verse ranges (e.g., "salmi 37:10-11" should match both 37:10 and 37:11)
    match = re.match(r'(.+?\s*\d+):(\d+)-(\d+)', ref_lower)
    if match:
        base = match.group(1)
        start_verse = int(match.group(2))
        end_verse = int(match.group(3))
        texts = []
        for v in range(start_verse, end_verse + 1):
            key = f"{base}:{v}"
            if key in SCRIPTURES_DB:
                texts.append(SCRIPTURES_DB[key])
        if texts:
            return " ".join(texts)
    
    return None

async def fetch_scripture_text_from_wol(url: str, book_num: str = None, chapter: str = None, verse_start: str = None, verse_end: str = None) -> Optional[str]:
    """Fetch the actual scripture text from wol.jw.org"""
    try:
        # Remove the fragment from URL for fetching
        base_url = url.split('#')[0]
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
            }
            response = await client.get(base_url, headers=headers, follow_redirects=True)
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Find all verse spans
                verses = soup.find_all('span', class_='v')
                
                if verses and verse_start and book_num and chapter:
                    # Extract specific verses
                    verse_start_int = int(verse_start)
                    verse_end_int = int(verse_end) if verse_end else verse_start_int
                    
                    text_parts = []
                    for verse in verses:
                        verse_id = verse.get('id', '')
                        if verse_id:
                            parts = verse_id.replace('v', '').split('-')
                            if len(parts) >= 3:
                                v_book = parts[0]
                                v_chapter = parts[1]
                                v_verse = int(parts[2])
                                
                                if (v_book == book_num and 
                                    v_chapter == chapter and 
                                    verse_start_int <= v_verse <= verse_end_int):
                                    clean_text = verse.get_text(strip=True)
                                    clean_text = clean_text.replace('+', '')
                                    clean_text = re.sub(r'\*', '', clean_text)
                                    text_parts.append(clean_text)
                    
                    if text_parts:
                        return ' '.join(text_parts)
                        
        return None
    except Exception as e:
        logger.warning(f"Could not fetch scripture text (may be due to network restrictions): {type(e).__name__}")
        return None

async def fetch_scripture_from_wol(reference: str) -> Optional[Scripture]:
    """Fetch scripture text from wol.jw.org"""
    try:
        # Convert reference to URL format
        search_query = reference.replace(" ", "+")
        
        # Use the Italian WOL site
        base_url = "https://wol.jw.org/it/wol/b/r6/lp-i/nwtsty"
        
        # Map book names to their WOL codes
        book_mapping = {
            "genesi": "1", "esodo": "2", "levitico": "3", "numeri": "4",
            "deuteronomio": "5", "giosuè": "6", "giudici": "7", "rut": "8",
            "1 samuele": "9", "2 samuele": "10", "1 re": "11", "2 re": "12",
            "1 cronache": "13", "2 cronache": "14", "esdra": "15", "neemia": "16",
            "ester": "17", "giobbe": "18", "salmi": "19", "proverbi": "20",
            "ecclesiaste": "21", "cantico dei cantici": "22", "isaia": "23",
            "geremia": "24", "lamentazioni": "25", "ezechiele": "26",
            "daniele": "27", "osea": "28", "gioele": "29", "amos": "30",
            "abdia": "31", "giona": "32", "michea": "33", "naum": "34",
            "abacuc": "35", "sofonia": "36", "aggeo": "37", "zaccaria": "38",
            "malachia": "39", "matteo": "40", "marco": "41", "luca": "42",
            "giovanni": "43", "atti": "44", "romani": "45", "1 corinti": "46",
            "2 corinti": "47", "galati": "48", "efesini": "49", "filippesi": "50",
            "colossesi": "51", "1 tessalonicesi": "52", "2 tessalonicesi": "53",
            "1 timoteo": "54", "2 timoteo": "55", "tito": "56", "filemone": "57",
            "ebrei": "58", "giacomo": "59", "1 pietro": "60", "2 pietro": "61",
            "1 giovanni": "62", "2 giovanni": "63", "3 giovanni": "64",
            "giuda": "65", "rivelazione": "66", "apocalisse": "66"
        }
        
        # Parse reference
        ref_lower = reference.lower().strip()
        book_num = None
        chapter = None
        verse = None
        verse_end = None
        
        for book_name, num in book_mapping.items():
            if ref_lower.startswith(book_name):
                book_num = num
                remaining = ref_lower[len(book_name):].strip()
                # Parse chapter:verse or chapter:verse-verse
                match = re.match(r'(\d+):(\d+)(?:-(\d+))?', remaining)
                if match:
                    chapter = match.group(1)
                    verse = match.group(2)
                    verse_end = match.group(3) if match.group(3) else verse
                break
        
        wol_url = None
        scripture_text = None
        
        if book_num and chapter:
            # Build WOL URL for the specific verse
            wol_url = f"https://wol.jw.org/it/wol/b/r6/lp-i/nwtsty/{book_num}/{chapter}"
            if verse:
                wol_url += f"#{book_num}:{chapter}:{verse}"
            
            # Try to fetch the text with verse info
            scripture_text = await fetch_scripture_text_from_wol(
                wol_url, 
                book_num=book_num, 
                chapter=chapter, 
                verse_start=verse, 
                verse_end=verse_end
            )
        else:
            # Fallback to search URL
            wol_url = f"https://wol.jw.org/it/wol/s/r6/lp-i?q={search_query}"
        
        return Scripture(
            reference=reference,
            text=scripture_text,
            url=wol_url
        )
        
    except Exception as e:
        logger.error(f"Error fetching scripture: {e}")
        return Scripture(reference=reference, text=None, url=None)

async def generate_presentation_with_ai(topic: str, news_context: str = None, existing_presentations: List[dict] = None) -> dict:
    """Generate a presentation using AI based on topic and context"""
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise ValueError("EMERGENT_LLM_KEY not configured")
        
        # Generate a unique seed for variety
        import random
        variety_seed = random.randint(1, 1000)
        
        # Different intro styles to encourage variety
        intro_styles = [
            "una domanda pensierosa",
            "un'osservazione sulla vita quotidiana", 
            "un riferimento a qualcosa di attuale",
            "una riflessione personale",
            "un complimento sincero seguito da una domanda",
            "un'osservazione sul quartiere o la zona",
            "una domanda su un problema comune",
            "un pensiero positivo sul futuro"
        ]
        selected_style = random.choice(intro_styles)
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"jwpresent-{uuid.uuid4()}",
            system_message=f"""Sei un assistente esperto per i Testimoni di Geova. Il tuo compito è creare presentazioni UNICHE per l'opera di predicazione casa per casa.

REGOLA FONDAMENTALE: Ogni presentazione deve avere un'introduzione COMPLETAMENTE DIVERSA dalle altre, anche se l'argomento è lo stesso.

Per questa presentazione, usa questo stile di introduzione: {selected_style}
Seed di varietà: {variety_seed}

Le presentazioni devono essere:
- Rispettose e gentili
- Basate sulla Bibbia
- Pertinenti agli avvenimenti attuali quando possibile
- Pratiche e facili da usare
- CON INTRODUZIONI SEMPRE DIVERSE E CREATIVE

Tipi di introduzioni da alternare:
- Domande aperte ("Ha mai pensato...", "Secondo lei...")
- Osservazioni ("Ho notato che molte persone oggi...", "È interessante vedere come...")
- Riferimenti attuali ("Con tutto quello che succede nel mondo...")
- Approcci diretti ("Stiamo condividendo un pensiero biblico...")
- Approcci indiretti ("Passavo di qui e mi chiedevo...")

Rispondi sempre in italiano e in formato JSON con questa struttura:
{{
    "title": "Titolo della presentazione",
    "intro": "Frase di apertura UNICA per iniziare la conversazione",
    "main_points": ["Punto 1", "Punto 2"],
    "questions": ["Domanda 1?", "Domanda 2?"],
    "scriptures": [{{"reference": "Giovanni 3:16"}}, {{"reference": "Matteo 24:14"}}],
    "objections": [{{"objection": "Obiezione comune", "response": "Risposta suggerita"}}],
    "topic": "Argomento principale"
}}"""
        ).with_model("openai", "gpt-5.2")
        
        # Build the prompt with emphasis on uniqueness
        prompt_parts = [
            f"Crea una presentazione NUOVA e UNICA per l'opera di predicazione sull'argomento: {topic}",
            f"\nIMPORTANTE: L'introduzione deve essere DIVERSA da qualsiasi altra. Usa lo stile: {selected_style}",
            f"\nNumero di varietà: {variety_seed} - usa questo per ispirarti a creare qualcosa di unico."
        ]
        
        if news_context:
            prompt_parts.append(f"\nContesto delle notizie attuali: {news_context}")
        
        if existing_presentations and len(existing_presentations) > 0:
            # Show existing intros to AVOID repetition
            existing_intros = [ex.get('intro', '') for ex in existing_presentations if ex.get('intro')]
            if existing_intros:
                prompt_parts.append("\n⚠️ EVITA di usare introduzioni simili a queste già esistenti:")
                for intro in existing_intros[:3]:
                    prompt_parts.append(f"- \"{intro[:100]}...\"")
                prompt_parts.append("\nCrea un'introduzione COMPLETAMENTE DIVERSA!")
        
        prompt_parts.append("\nRispondi SOLO con il JSON, senza altro testo.")
        
        user_message = UserMessage(text="\n".join(prompt_parts))
        response = await chat.send_message(user_message)
        
        # Parse JSON response
        import json
        # Clean response - remove markdown code blocks if present
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = re.sub(r'^```[\w]*\n?', '', response_text)
            response_text = re.sub(r'\n?```$', '', response_text)
        
        presentation_data = json.loads(response_text)
        return presentation_data
        
    except Exception as e:
        logger.error(f"Error generating presentation with AI: {e}")
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

async def fetch_news(location: str = None) -> List[NewsResponse]:
    """Fetch current news - using a simple approach"""
    # In a production app, you would integrate with a news API
    # For now, we'll return some sample topics that are always relevant
    sample_news = [
        NewsResponse(
            title="Crisi economica globale",
            description="L'incertezza economica continua a preoccupare molte famiglie",
            source="Attualità",
            url=None
        ),
        NewsResponse(
            title="Cambiamenti climatici",
            description="Eventi meteorologici estremi in aumento",
            source="Ambiente",
            url=None
        ),
        NewsResponse(
            title="Tensioni internazionali",
            description="Conflitti e tensioni geopolitiche nel mondo",
            source="Politica internazionale",
            url=None
        ),
        NewsResponse(
            title="Salute mentale in crescita",
            description="Aumentano i casi di ansia e depressione",
            source="Salute",
            url=None
        ),
        NewsResponse(
            title="Crisi della famiglia",
            description="Sempre più famiglie in difficoltà",
            source="Società",
            url=None
        )
    ]
    return sample_news

# ============= API Routes =============

@api_router.get("/")
async def root():
    return {"message": "JW Present API", "version": "1.0.0"}

# Presentations CRUD
@api_router.post("/presentations", response_model=Presentation)
async def create_presentation(input: PresentationCreate):
    """Create a new presentation"""
    presentation_dict = input.dict()
    presentation_obj = Presentation(**presentation_dict)
    
    # Enrich scriptures with URLs
    enriched_scriptures = []
    for scripture in presentation_obj.scriptures:
        enriched = await fetch_scripture_from_wol(scripture.reference)
        enriched_scriptures.append(enriched)
    presentation_obj.scriptures = enriched_scriptures
    
    await db.presentations.insert_one(presentation_obj.dict())
    return presentation_obj

@api_router.get("/presentations", response_model=List[Presentation])
async def get_presentations():
    """Get all presentations"""
    presentations = await db.presentations.find().sort("updated_at", -1).to_list(100)
    return [Presentation(**p) for p in presentations]

@api_router.get("/presentations/{presentation_id}", response_model=Presentation)
async def get_presentation(presentation_id: str):
    """Get a single presentation by ID"""
    presentation = await db.presentations.find_one({"id": presentation_id})
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")
    return Presentation(**presentation)

@api_router.put("/presentations/{presentation_id}", response_model=Presentation)
async def update_presentation(presentation_id: str, input: PresentationUpdate):
    """Update a presentation"""
    presentation = await db.presentations.find_one({"id": presentation_id})
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")
    
    update_data = {k: v for k, v in input.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    # Enrich scriptures if updated
    if "scriptures" in update_data:
        enriched_scriptures = []
        for scripture in update_data["scriptures"]:
            if isinstance(scripture, dict):
                enriched = await fetch_scripture_from_wol(scripture.get("reference", ""))
            else:
                enriched = await fetch_scripture_from_wol(scripture.reference)
            enriched_scriptures.append(enriched.dict())
        update_data["scriptures"] = enriched_scriptures
    
    await db.presentations.update_one(
        {"id": presentation_id},
        {"$set": update_data}
    )
    
    updated = await db.presentations.find_one({"id": presentation_id})
    return Presentation(**updated)

@api_router.delete("/presentations/{presentation_id}")
async def delete_presentation(presentation_id: str):
    """Delete a presentation"""
    result = await db.presentations.delete_one({"id": presentation_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Presentation not found")
    return {"message": "Presentation deleted successfully"}

# AI Generation
@api_router.post("/presentations/generate", response_model=Presentation)
async def generate_presentation(request: GenerateRequest):
    """Generate a presentation using AI"""
    topic = request.topic or "Speranza per il futuro"
    
    # Get existing presentations as examples
    existing = await db.presentations.find().limit(3).to_list(3)
    
    # Build news context
    news_context = request.news_context
    if not news_context and request.location:
        news = await fetch_news(request.location)
        if news:
            news_context = "; ".join([f"{n.title}: {n.description}" for n in news[:3]])
    
    # Generate with AI
    generated_data = await generate_presentation_with_ai(
        topic=topic,
        news_context=news_context,
        existing_presentations=existing
    )
    
    # Create presentation object
    presentation_obj = Presentation(
        title=generated_data.get("title", f"Presentazione su {topic}"),
        intro=generated_data.get("intro", ""),
        main_points=generated_data.get("main_points", []),
        questions=generated_data.get("questions", []),
        scriptures=[Scripture(**s) for s in generated_data.get("scriptures", [])],
        objections=generated_data.get("objections", []),
        topic=generated_data.get("topic", topic),
        is_ai_generated=True
    )
    
    # Enrich scriptures with URLs
    enriched_scriptures = []
    for scripture in presentation_obj.scriptures:
        enriched = await fetch_scripture_from_wol(scripture.reference)
        enriched_scriptures.append(enriched)
    presentation_obj.scriptures = enriched_scriptures
    
    # Save to database
    await db.presentations.insert_one(presentation_obj.dict())
    
    return presentation_obj

# News
@api_router.get("/news", response_model=List[NewsResponse])
async def get_news(location: Optional[str] = None):
    """Get current news topics"""
    return await fetch_news(location)

# Scripture lookup
@api_router.get("/scriptures/lookup")
async def lookup_scripture(reference: str):
    """Look up a scripture and get its WOL URL"""
    scripture = await fetch_scripture_from_wol(reference)
    return scripture

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
