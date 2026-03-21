const fs = require('fs');
const path = require('path');

const verbsPath = path.join(__dirname, '..', 'src', 'data', 'verbs.json');

// Read existing data
const data = JSON.parse(fs.readFileSync(verbsPath, 'utf-8'));

// Example sentences for the first 100 verbs
const examples = {
  ser: [
    "Soy estudiante de medicina.",
    "Fue un día increíble."
  ],
  estar: [
    "Estoy muy contento con los resultados.",
    "Ayer estuvimos en la playa todo el día."
  ],
  ir: [
    "Vamos al cine esta noche.",
    "Fui al supermercado después del trabajo."
  ],
  haber: [
    "Ha llovido mucho esta semana.",
    "Había muchas personas en la fiesta."
  ],
  hacer: [
    "¿Qué haces los fines de semana?",
    "Hicimos una torta para su cumpleaños."
  ],
  decir: [
    "Siempre dice la verdad.",
    "¿Qué dijiste? No te escuché."
  ],
  dar: [
    "Le di un regalo a mi madre.",
    "El profesor nos da mucha tarea."
  ],
  ver: [
    "¿Viste la película nueva?",
    "Desde aquí se ve toda la ciudad."
  ],
  oír: [
    "¿Oyes esa música?",
    "Oí un ruido extraño por la noche."
  ],
  leer: [
    "Leo un libro antes de dormir.",
    "Leyó toda la novela en un fin de semana."
  ],
  reír: [
    "Nos reímos mucho con esa película.",
    "El bebé se ríe todo el tiempo."
  ],
  sonreír: [
    "Ella siempre sonríe cuando me ve.",
    "Sonrió al recibir la buena noticia."
  ],
  saber: [
    "¿Sabes dónde está la estación?",
    "No sabía que hablabas francés."
  ],
  caber: [
    "No cabe más ropa en la maleta.",
    "¿Crees que este sofá cabrá por la puerta?"
  ],
  tener: [
    "Tengo dos hermanos mayores.",
    "Tenía mucho frío esa noche."
  ],
  venir: [
    "¿Vienes a la fiesta el sábado?",
    "Vinieron todos mis amigos a visitarme."
  ],
  poner: [
    "Pon los platos en la mesa, por favor.",
    "Se puso nerviosa antes del examen."
  ],
  salir: [
    "Salimos a cenar todos los viernes.",
    "Salió el sol después de la tormenta."
  ],
  valer: [
    "¿Cuánto vale este reloj?",
    "No vale la pena preocuparse por eso."
  ],
  caer: [
    "Se cayó de la bicicleta.",
    "Las hojas caen en otoño."
  ],
  traer: [
    "¿Puedes traer pan cuando vengas?",
    "Traje los documentos que me pediste."
  ],
  pensar: [
    "Pienso que es una buena idea.",
    "Pensábamos ir a la montaña este verano."
  ],
  cerrar: [
    "Cierra la puerta, por favor.",
    "La tienda cerró a las nueve."
  ],
  despertar: [
    "Me despierto a las seis todos los días.",
    "El ruido lo despertó a medianoche."
  ],
  recomendar: [
    "Te recomiendo este restaurante.",
    "El médico le recomendó descansar más."
  ],
  calentar: [
    "Voy a calentar la sopa.",
    "El sol calentó la arena de la playa."
  ],
  confesar: [
    "Confesó que había tomado el dinero.",
    "Tengo que confesar algo importante."
  ],
  sentar: [
    "Siéntate aquí, por favor.",
    "Nos sentamos en la primera fila."
  ],
  acertar: [
    "Acertaste la respuesta correcta.",
    "No siempre se acierta en las decisiones."
  ],
  apretar: [
    "Aprieta el botón para encender la máquina.",
    "Estos zapatos me aprietan mucho."
  ],
  atravesar: [
    "Atravesamos el puente con cuidado.",
    "El río atraviesa toda la ciudad."
  ],
  gobernar: [
    "Ese partido gobernó el país durante diez años.",
    "Es difícil gobernar sin el apoyo del pueblo."
  ],
  helar: [
    "Anoche heló y las plantas se dañaron.",
    "El viento helaba los dedos de las manos."
  ],
  manifestar: [
    "Los ciudadanos se manifestaron en la plaza.",
    "Manifestó su desacuerdo con la nueva ley."
  ],
  merendar: [
    "Los niños meriendan fruta y galletas.",
    "Merendamos en el parque ayer por la tarde."
  ],
  nevar: [
    "Nevó mucho en las montañas este invierno.",
    "¿Crees que nevará mañana?"
  ],
  sembrar: [
    "Mi abuelo siembra tomates cada primavera.",
    "Sembraron árboles en todo el barrio."
  ],
  temblar: [
    "Me temblaban las manos de nervios.",
    "La tierra tembló durante treinta segundos."
  ],
  tropezar: [
    "Tropecé con una piedra en el camino.",
    "Ten cuidado, no tropieces con ese escalón."
  ],
  fregar: [
    "Después de comer, fregamos los platos.",
    "¿Ya fregaste el suelo de la cocina?"
  ],
  comenzar: [
    "La clase comienza a las ocho.",
    "Comenzó a llover de repente."
  ],
  empezar: [
    "Voy a empezar a estudiar español.",
    "La película empezó hace diez minutos."
  ],
  negar: [
    "Negó haber estado en ese lugar.",
    "No puedes negar la evidencia."
  ],
  entender: [
    "¿Entiendes lo que digo?",
    "Al principio no entendía nada de español."
  ],
  perder: [
    "Perdí las llaves del coche.",
    "El equipo perdió el partido por dos goles."
  ],
  defender: [
    "El abogado defendió a su cliente con pasión.",
    "Siempre defiende sus ideas con argumentos sólidos."
  ],
  encender: [
    "Enciende la luz, por favor.",
    "Encendimos una fogata en el camping."
  ],
  ascender: [
    "Ascendió al puesto de directora el año pasado.",
    "Los montañistas ascendieron hasta la cima."
  ],
  descender: [
    "La temperatura descendió diez grados en una hora.",
    "Descendimos por un sendero estrecho."
  ],
  atender: [
    "La enfermera atiende a los pacientes con cariño.",
    "¿Quién me atiende, por favor?"
  ],
  tender: [
    "Voy a tender la ropa al sol.",
    "Tiende a olvidar las cosas importantes."
  ],
  verter: [
    "Vertió el agua en el vaso con cuidado.",
    "No viertas el aceite en el fregadero."
  ],
  querer: [
    "Te quiero mucho.",
    "Quería comprar un coche nuevo, pero era muy caro."
  ],
  sentir: [
    "Siento mucho lo que pasó.",
    "Se sentía cansada después del viaje."
  ],
  preferir: [
    "Prefiero el café sin azúcar.",
    "Prefirieron quedarse en casa por la lluvia."
  ],
  mentir: [
    "No me mientas, dime la verdad.",
    "Mintió sobre su edad para entrar al club."
  ],
  divertir: [
    "Los niños se divierten en el parque.",
    "Nos divertimos mucho en la fiesta de anoche."
  ],
  convertir: [
    "Convirtieron la oficina en una sala de juegos.",
    "El agua se convierte en hielo a cero grados."
  ],
  hervir: [
    "El agua ya está hirviendo.",
    "Hierve las verduras durante diez minutos."
  ],
  sugerir: [
    "Te sugiero que llegues temprano.",
    "El camarero nos sugirió el plato del día."
  ],
  advertir: [
    "Te advierto que el camino es peligroso.",
    "Nos advirtieron sobre la tormenta."
  ],
  referir: [
    "Se refiere al artículo que leímos ayer.",
    "El doctor lo refirió a un especialista."
  ],
  invertir: [
    "Invirtió su dinero en un negocio nuevo.",
    "Es importante invertir tiempo en aprender."
  ],
  transferir: [
    "Voy a transferir el dinero a tu cuenta.",
    "Transfirieron al empleado a otra oficina."
  ],
  diferir: [
    "Nuestras opiniones difieren en ese tema.",
    "Decidieron diferir la reunión para la próxima semana."
  ],
  inferir: [
    "De sus palabras puedo inferir que está molesto.",
    "Infirieron la causa del problema tras el análisis."
  ],
  herir: [
    "Sus palabras me hirieron profundamente.",
    "El soldado fue herido en la batalla."
  ],
  adquirir: [
    "Adquirieron una casa en el centro de la ciudad.",
    "Es importante adquirir buenos hábitos desde joven."
  ],
  encontrar: [
    "Encontré las llaves debajo del sofá.",
    "¿Dónde puedo encontrar una farmacia?"
  ],
  contar: [
    "Mi abuela me contaba historias antes de dormir.",
    "¿Puedes contar hasta cien en español?"
  ],
  recordar: [
    "¿Recuerdas la primera vez que nos vimos?",
    "No recordaba su nombre."
  ],
  mostrar: [
    "Muéstrame las fotos de tu viaje.",
    "El guía nos mostró los lugares más importantes."
  ],
  probar: [
    "Prueba este pastel, está delicioso.",
    "Probaron un nuevo método de enseñanza."
  ],
  soñar: [
    "Anoche soñé que volaba por el cielo.",
    "Sueña con viajar por todo el mundo."
  ],
  volar: [
    "Los pájaros vuelan hacia el sur en invierno.",
    "Volamos de Madrid a Buenos Aires en doce horas."
  ],
  costar: [
    "¿Cuánto cuesta este vestido?",
    "Me costó mucho aprender a conducir."
  ],
  acordar: [
    "Acordamos vernos el próximo lunes.",
    "No me acuerdo de dónde dejé el libro."
  ],
  apostar: [
    "Apuesto a que mañana hace sol.",
    "Apostaron todo su dinero en ese proyecto."
  ],
  aprobar: [
    "Aprobé todos los exámenes del semestre.",
    "El gobierno aprobó una nueva ley de educación."
  ],
  consolar: [
    "Intenté consolar a mi amiga después de la mala noticia.",
    "Su madre lo consoló con un abrazo."
  ],
  demostrar: [
    "Demostró su talento en el concurso.",
    "Los datos demuestran que el plan funciona."
  ],
  renovar: [
    "Necesito renovar mi pasaporte antes del viaje.",
    "Renovaron toda la cocina el año pasado."
  ],
  rodar: [
    "La pelota rodó hasta el otro lado de la calle.",
    "Rodaron la película en una ciudad pequeña."
  ],
  soltar: [
    "Suelta la cuerda cuando yo te diga.",
    "El niño soltó el globo y voló al cielo."
  ],
  sonar: [
    "Sonó el teléfono a las tres de la mañana.",
    "Esa canción me suena, pero no recuerdo el nombre."
  ],
  forzar: [
    "No me fuerces a tomar una decisión ahora.",
    "Forzaron la cerradura para entrar al edificio."
  ],
  esforzar: [
    "Me esfuerzo cada día para mejorar mi español.",
    "Se esforzó mucho para conseguir ese trabajo."
  ],
  torcer: [
    "Tuerce a la derecha en la próxima esquina.",
    "Me torcí el tobillo jugando al fútbol."
  ],
  almorzar: [
    "Almorzamos juntos en la cafetería del trabajo.",
    "¿A qué hora almuerzas normalmente?"
  ],
  colgar: [
    "Cuelga el abrigo en el perchero.",
    "Colgaron las luces de Navidad en el balcón."
  ],
  rogar: [
    "Te ruego que me escuches un momento.",
    "Le rogó una segunda oportunidad."
  ],
  volver: [
    "Volveré a casa antes de las diez.",
    "Volvimos del viaje muy cansados."
  ],
  mover: [
    "¿Me ayudas a mover esta mesa?",
    "Se mudó a otra ciudad por trabajo."
  ],
  llover: [
    "Está lloviendo mucho hoy.",
    "Llovió durante toda la semana pasada."
  ],
  devolver: [
    "Tengo que devolver este libro a la biblioteca.",
    "Le devolvieron el dinero por el producto defectuoso."
  ],
  resolver: [
    "Resolvimos el problema en menos de una hora.",
    "¿Cómo podemos resolver esta situación?"
  ],
  envolver: [
    "¿Puedes envolver este regalo, por favor?",
    "Envolvió los libros en papel de periódico."
  ],
  promover: [
    "La empresa promueve un ambiente de trabajo saludable.",
    "Lo promovieron a gerente regional."
  ],
  remover: [
    "Remueve la salsa para que no se pegue.",
    "Removieron los escombros después del terremoto."
  ],
  disolver: [
    "Disuelve el azúcar en el agua caliente.",
    "El parlamento fue disuelto por el presidente."
  ]
};

// Apply examples to the first 100 verbs
const keys = Object.keys(data);
const first100 = keys.slice(0, 100);

let added = 0;
for (const verb of first100) {
  if (examples[verb]) {
    data[verb].examples = examples[verb];
    added++;
  } else {
    console.warn(`WARNING: No examples found for verb "${verb}"`);
  }
}

// Write back
fs.writeFileSync(verbsPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');

console.log(`Done! Added examples to ${added} out of ${first100.length} verbs.`);
