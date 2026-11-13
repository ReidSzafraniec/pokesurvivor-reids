# PokéSurvivor · Mundo Misterioso

Bullet-heaven con Pokémon al estilo de Survivor.io y Megabonk, con sprites de
*Pokémon Mundo Misterioso*, capa roguelike, **966 Pokémon de las 9 generaciones**,
shinies y gacha por región. Música y efectos compuestos para el juego.

HTML + CSS + JavaScript sobre Canvas 2D, en el navegador y en el móvil.

> **Autoría / Authorship**
>
> PokéSurvivor (su código y su música original) lo ha escrito y es de
> **Jonathan Piera Torregrosa**, dueño de esta cuenta (JPTER78) y de pokesurvivor.com.
> The source code and original music of PokéSurvivor are written and owned by
> **Jonathan Piera Torregrosa**, owner of this GitHub account (JPTER78) and of
> pokesurvivor.com. Google copyright removal request **4-2352000042234**
> (against pokesurvivor.co) was submitted by me.

> **Aviso sobre criptomonedas / Crypto disclaimer**
>
> PokéSurvivor **no tiene ninguna criptomoneda, token ni NFT oficial**, y yo no
> he creado ninguno. Cualquier token que use el nombre del juego lo han creado
> terceros. **No me hago cargo de ninguna compra, venta o inversión** que hagas
> con ellos y nada de lo que hay aquí es una recomendación de inversión. El
> juego es gratis y lo seguirá siendo.
>
> PokéSurvivor has **no official cryptocurrency, token or NFT**, and I have not
> created any. Any token using the game's name was created by third parties.
> **I take no responsibility for any purchase, sale or investment** you make
> with them, and nothing here is investment advice. The game is free and will
> stay free.

## Jugar

Entra en [pokesurvivor.com](https://pokesurvivor.com). Crea una cuenta o entra como invitado
y elige compañero directamente, sin test de personalidad. Las pestañas muestran los tres
iniciales de cada región, de Kanto a Paldea, más Pikachu en Kanto. Selecciona un Pokémon
y pulsa **Elegir compañero** para llegar al pueblo. Las cuentas que ya tienen compañero
lo conservan.

Puedes elegir con **ratón o pantalla táctil**, con **Tab / flechas** y
**Intro / Espacio**, o con **cruceta / palanca y A** en el mando. Cambiar de región
borra la selección pendiente; no recibes el Pokémon hasta confirmar.

| Tecla | Acción |
|---|---|
| `W` `A` `S` `D` / flechas | Moverse |
| `5` `6` `7` `8` | Usar esferas |
| `Esc` / `P` | Pausa |

**En móvil o tablet** (en vertical u horizontal): pon el dedo en cualquier sitio y arrastra
para moverte (el joystick aparece donde tocas), toca una esfera para usarla
y el botón de arriba a la derecha para pausar. Se puede instalar como
app ("Añadir a pantalla de inicio"). En **Ajustes** hay sonido, calidad gráfica
(con modo automático), números de daño, menos sacudidas, FPS y la cuenta.

El Pokémon usa **todos sus movimientos equipados automáticamente desde el
inicio**, combinados en un solo grupo de hasta cuatro movimientos. No hace falta
cambiar de ataque ni vencer a un legendario para vincularlos. Cada movimiento
conserva su tiempo de recarga y sus requisitos de alcance y objetivo; los
movimientos de apoyo también están activos. Las rocas, cofres y la hierba
alta se rompen; las paredes y los árboles bloquean los disparos enemigos; el
agua frena y la lava quema (también a los enemigos).

En el mapa hay **altares de poder**, **manantiales** que curan, **cofres con
candado** (quédate a su lado unos segundos) y **trampas** que también dañan a
los enemigos. A veces se abre una **grieta**: entra y lucharás contra un
**legendario** en una arena aparte.

Hay **tabla de tipos** (un Rayo Burbuja le quita más a un Charmander) y,
de vez en cuando, **climas** (sol, lluvia, arena, nieve, niebla) que potencian
unos tipos y debilitan otros.

Cada día hay **misiones** (y semanales) que dan tickets y monedas; los
**logros** dan medallas y títulos, y tu **perfil** enseña tus 3 Pokémon
favoritos, tus marcas y tus medallas. En las runs encuentras **objetos** (Restos,
Cinta Elección...) y mejoras temporales de estadísticas. Los
enemigos tienen personalidad: curan, ponen escudos, llaman a su manada o atacan
con aviso en el suelo.

Las **mejoras** son de cada Pokémon. El **gacha** va con **tickets** que se
ganan jugando (×1 de algunos Pokémon, ×10 de jefes y legendarios), y se tira
en una tragaperras pixel art.

Cada enemigo tiene 1/4096 de salir **shiny**: brilla, una flecha en el borde de
la pantalla te dice dónde está, y si lo derrotas te lo quedas. En el gacha sale
shiny 1 de cada 100 tiradas. En la colección eliges tu compañero en versión
normal o shiny.

La música suena tras el primer clic (los navegadores no dejan reproducir sonido
antes). Volumen y silencio: botón del altavoz arriba a la derecha, o en la pausa.

El guardado local de las cuentas vive en el `localStorage` del navegador: si
borras los datos del sitio y no tienes copia en la nube, se pierde. Los invitados
no guardan progreso al cerrar o recargar.

## Interfaz

La interfaz usa ventanas de píxeles al estilo de Mundo Misterioso y de las consolas
portátiles: marcos nítidos, botones con relieve y sombras duras, sin desenfoques. Se adapta
a cualquier pantalla, en vertical u horizontal, también durante la partida: en vertical ves
la misma porción del mapa que en horizontal, girada.

En iPhone y otros móviles con isla, muesca o barra de inicio, nada interactivo queda debajo:
todo se coloca dentro de la zona segura que indica el sistema. En el móvil, los botones
secundarios de la barra de arriba (perfil, novedades, YouTube, apoyar, guardar, pantalla
completa y salir) están en el botón **⋯**. En monitores grandes la interfaz y el HUD de la
partida se amplían a escalas enteras (×2 desde 2560×1440 y ×3 desde 3840×2160) para que
cada píxel siga siendo nítido.

Si colocas a mano los botones táctiles, se guarda una disposición para vertical y otra para
horizontal.

Para revisar la interfaz en varios dispositivos:

```sh
npm install
npx playwright install chromium
npm run shots                 # o: npm run shots -- --only=iphone-15-pro
```

Las capturas quedan en `.shots/`, con las zonas inseguras simuladas rayadas en rojo.

## Pueblo principal

Al entrar, después de elegir compañero, llegas a **Villa Compañera**: un pueblo
sin combate que recorres con tu Pokémon seleccionado, en su versión normal o
shiny. El pueblo tiene siete edificios con tejados y fachadas diferentes:
un gimnasio rotulado **Entrenamiento**, un centro rotulado **Pokémon** para la colección,
**Ajustes**, la **Tienda** de Kecleon, **Mochila**, **Gacha** y **Misiones**.
El Centro Pokémon ocupa la antigua parcela de Amigos al oeste de la plaza;
Misiones está en la parcela del noreste. **Amigos** se abre desde la cabina de
teléfono situada en el césped a la derecha del tablón del Ranking.
Los caminos conectan una plaza adoquinada, un estanque, bancos y jardines,
rodeados de árboles; las farolas están alineadas fuera de los caminos.

El **Ranking** se consulta en un tablón junto a la plaza. Para preparar una
**Expedición**, sigue el camino que sale del pueblo hacia el norte y usa el botón
de interacción: caminar hasta la salida no abre la preparación ni empieza una
partida automáticamente. Se conserva la preparación de movimientos existente.
No hay una casa separada de **Mejoras**; sus opciones están integradas en
**Entrenamiento** junto con los movimientos. Los edificios, el tablón y la cabina
abren las pantallas existentes, sin interiores.

Muévete con **WASD o las flechas** y pulsa **E o Espacio** cerca de una puerta,
el tablón, la cabina o la salida norte para interactuar. El panel de interacción
solo aparece al situarte directamente delante del destino; no se activa desde
un lateral ni por detrás. En móvil y tableta, en vertical u horizontal, hay una cruceta y el mismo botón
contextual.
**M, Esc o Menú** abren el menú de siempre sin tener que caminar; **Volver al
pueblo** lo cierra. Al cerrar una pantalla abierta desde una puerta, vuelves al
mismo sitio; si la abriste desde el menú, vuelves a la lista.

El pueblo no cambia tus monedas, colección, entrenamiento ni guardado. No da
XP por caminar y la posición sólo dura durante la sesión de esa cuenta.
Para ahorrar batería, el pueblo sólo se vuelve a dibujar cuando algo se mueve o
cambia de animación, y los árboles, farolas y bancos iguales comparten una
única imagen en memoria.
Al crear o aceptar una sala cooperativa, hasta **cuatro jugadores** comparten
este mismo pueblo. Cada uno mueve su Pokémon y su propia cámara; los demás
jugadores no bloquean el paso. Las puertas abren únicamente los menús de quien
interactúa, con sus propias monedas, colección, mochila y entrenamiento.
Los demás pueden seguir caminando aunque el anfitrión tenga un menú abierto.
La posición y el aspecto se sincronizan durante la sesión; no se comparten
guardados ni compras.

El botón **Preparar grupo**, la salida norte y **Jugar** abren la sala para
invitar amigos y preparar la siguiente expedición. Cada jugador, incluido el
anfitrión, debe pulsar **Prepararme**. **Cerrar esa sala cancela tu preparado**:
al volver hay que prepararse otra vez. Si alguien entra, sale o se reconecta,
se cancela el preparado de todos. El anfitrión puede empezar cuando todos los
miembros actuales estén conectados y preparados, con un mínimo de dos jugadores.
Si la conexión o la confirmación de inicio falla, se muestra el problema y
hay que volver a prepararse. Todos deben usar una versión compatible del juego.

Al terminar una partida, primero se mantienen los resultados, la XP permanente
y las evoluciones, y después se vuelve al pueblo, compartido si sigues en la
sala. Salir de la sala no cambia tu progreso; si sale el anfitrión, la sala se
cierra como antes.

## Entrenamiento persistente

Hay **dos niveles independientes**. El **nivel de la partida** empieza en 1,
sube al recoger XP y da mejoras temporales de estadísticas; tanto el nivel como
esas mejoras se reinician en cada partida. No desbloquea movimientos ni evoluciones.
Los objetos siguen funcionando y los movimientos ya empiezan vinculados, pero
no se consiguen, mejoran ni evolucionan ataques con las cartas de nivel.

El **nivel permanente de Pokémon** llega hasta 100. Los futuros resultados del
gacha, normales y shiny, dejan a la especie como mínimo en nivel 5, sin reducir
XP ni cambiar conjuntos válidos de Pokémon ya entrenados. No se migran otras
adquisiciones ni se sube toda la colección al iniciar sesión.

Una cuenta nueva o un invitado elige compañero y entra directamente en un
**combate tutorial individual**. El compañero empieza en nivel permanente 1:
aprendes a moverte, a derrotar enemigos y a recoger su experiencia para elegir
dos mejoras temporales reales. Cada mejora requiere varios enemigos y sus
cristales normales de XP; no aparecen cristales gratuitos junto al jugador.
Después aparece una gran oleada que se repone y aumenta su presión,
sin muerte forzada ni límite de supervivencia. Puedes saltar el tutorial en
cualquier momento. Cualquier derrota o salto da al compañero **exactamente
nivel permanente 5**, sin XP adicional por rendimiento, y abre la preparación
del primer conjunto: hasta cuatro movimientos distintos, con al menos un
ataque y los apoyos de Velocidad, Ataque y Defensa disponibles. Al guardarlo
entras en el pueblo.

El tutorial es práctica: no otorga monedas, objetos, capturas, misiones,
logros ni récords de partidas normales. Las cuentas guardan la etapa pendiente:
al volver, la práctica incompleta se reinicia y la preparación pendiente se
reabre sin repetir la recompensa. Los invitados conservan esto solo mientras
dura su sesión. Las cuentas que ya tenían compañero sin tutorial pendiente
siguen entrando como antes.

Fuera de estas recompensas iniciales, el Pokémon solo gana XP
al terminar una partida (también al salir desde la pausa), según el tiempo
sobrevivido y los Pokémon derrotados, con un extra por jefes. Desbloquea movimientos
y evoluciones a sus niveles oficiales y aumenta las estadísticas iniciales.
Del nivel 1 al 100, HP, Ataque, Ataque Especial, Defensa y Defensa Especial
crecen de forma lineal hasta +50%; Velocidad, hasta +15%. La naturaleza aplica
una sola vez su +10% y -10% habituales, sin IV ni EV. Se usan estadísticas
adaptadas al juego de supervivencia, no la fórmula oficial de estadísticas.
La XP de las esferas y los multiplicadores temporales solo afectan al nivel
de la partida. Se conserva toda la XP permanente que ya tenías.

**Entrenamiento** reúne estadísticas, naturaleza, habilidad, movimientos y
compras en una pantalla, con pestañas **Movimientos** y **Ventajas**.
Las Pokémonedas compran velocidad, recarga, regeneración, recogida, aprendizaje,
monedas, críticos y cambios de cartas; ya no compran HP, ataques ni defensas.
Las antiguas compras de esas tres estadísticas no tienen efecto y no se
reembolsan. **Zancada** conserva el equilibrio original: +3% de velocidad por
rango, hasta ocho (+24%), con un precio inicial de 70 monedas y un factor de
precio de 1,4 por rango, redondeado a la decena más cercana. Se compra por
Pokémon y se suma como multiplicador al crecimiento de velocidad por nivel;
los rangos de velocidad ya guardados vuelven a tener efecto.
Mentas y Cápsulas siguen consumiendo objetos de la mochila.
**Aprendizaje** da +5% por rango (hasta ocho) tanto a la XP de partida como a
los puntos de rendimiento que se convierten en XP permanente. Se toma el rango
comprado al empezar la partida; Huevo Suerte y los demás multiplicadores
temporales no aumentan la XP permanente.

El rendimiento se convierte primero en
`floor(segundos / 2 + sqrt(segundos × derrotados) / 4 + jefes × 15)` puntos.
Después se aplica el multiplicador comprado de Aprendizaje, antes de convertir
esos puntos en XP.
El extra por derrotados tiene rendimientos decrecientes para que las grandes
hordas no disparen los niveles; dividir una partida en varias no aumenta sus
puntos totales para el mismo rendimiento. Los puntos se convierten en XP usando
la curva oficial de cada especie: antes del nivel 10, cada punto da
`max(1, XP oficial del nivel 10 / 600)` XP; desde el 10 da
`1 + (nivel - 10) / 3` XP. La conversión se recalcula al cruzar cada nivel
y solo se redondea hacia abajo al guardar la XP final.

Al terminar hay **dos pantallas**: primero, los resultados de la partida
(tiempo, nivel temporal, derrotados, recompensas y resumen de daño); al pulsar
**Continuar a XP permanente**, aparece el progreso del Pokémon con la XP ganada,
el cambio de nivel permanente y los nuevos movimientos. Puedes volver a consultar
los resultados sin recibir XP adicional. Las evoluciones disponibles se presentan
desde esta segunda pantalla antes de volver al menú.

La referencia de equilibrio es **nivel 10 en unos 10–15 minutos** entre partidas
cortas y **nivel 36 en unas 2–3 horas** para un inicial típico. Por ejemplo,
partidas de 5 minutos con 150 derrotados y 2 jefes llegan al 10 en 15 minutos
y al 36 en unos 160 minutos; las de 3 minutos con 60 derrotados y 1 jefe
tardan 15 y 171 minutos. No son plazos garantizados: dependen del rendimiento
y del grupo de crecimiento, que sigue siendo distinto después del nivel 10.

En **Entrenamiento**, o al pulsar **Jugar**, eliges entre uno y **cuatro
movimientos distintos**, con al menos un ataque. Se equipan desde el inicio de
la partida y no se cambian mientras juegas. Todos los movimientos oficiales de
su nivel inicial que estén implementados están disponibles desde el principio,
con hasta cuatro equipados. Subir de nivel desbloquea opciones
para elegir después: no sustituye automáticamente tu equipo. La versión normal
y shiny comparten nivel y movimientos.

Los movimientos de apoyo incluyen **Rizo Defensa**, **Refugio**, **Defensa Férrea**,
**Rizo Algodón** y **Armadura Ácida**, que reutilizan Fortaleza, y **Afilar**,
**Meditación** y **Aullido**, que reutilizan Danza Espada.
Mantienen las mejoras temporales acumulables del juego, no un sistema nuevo de
niveles de estadísticas: hasta cinco acumulaciones durante siete segundos,
con +7 puntos porcentuales de reducción de daño o +13% de Ataque físico por
acumulación. Los movimientos del mismo atributo comparten esas acumulaciones.
Los movimientos parten de la versión oficial de referencia de cada especie,
con un ajuste para las **541 formas base**, incluidas las especies sin evolución:
al **nivel permanente 5** todas disponen de apoyos de **Velocidad, Ataque
físico o Especial y reducción de daño**, sin MT ni necesidad de evolucionar.
Para cada atributo se adelanta al nivel 5 su primer apoyo propio implementado;
si ya se aprende antes, conserva ese nivel. Si no tiene uno propio, recibe
**Agilidad**, **Danza Espada** o **Fortaleza** al 5, según el atributo que falte.
Los apoyos duales pueden cubrir dos atributos. La regeneración no cuenta como
reducción de daño. Los demás apoyos y las curaciones conservan sus niveles.
Afilar y Meditación están implementados, pero no tienen aprendices en las
versiones actualmente seleccionadas.

**Desarrollo** y **Avivar** acumulan Ataque físico y Ataque Especial a la vez
(+6,5% de cada uno por acumulación); **Corpulencia** acumula Ataque físico (+6,5%)
y reducción de daño (+3,5 puntos porcentuales). En todos los niveles del
movimiento, cada efecto dual tiene la mitad de la potencia del apoyo individual
correspondiente. Comparten con los otros apoyos las acumulaciones de cada
atributo, el máximo inicial de cinco y la duración inicial de siete segundos.
Los apoyos individuales y las mejoras por nivel no cambian. Se adaptan al
equilibrio existente, sin efectos adicionales por clima ni niveles de
estadísticas oficiales. El ajuste de las formas base no cambia su potencia,
sus acumulaciones ni la selección de hasta cuatro movimientos. Desbloquear
un apoyo no cambia automáticamente el equipo elegido; los movimientos
aprendidos se conservan al evolucionar.

Los demás apoyos reutilizan exclusivamente esas mismas mejoras del juego:

| Efecto existente | Nuevos movimientos |
| --- | --- |
| Danza Espada: Ataque físico | Afilagarras, Tambor |
| Maquinación: Ataque Especial | Luminicola |
| Agilidad: Velocidad | Pulimento, Aligerar, Viento Afín |
| Fortaleza: reducción de daño | Amnesia, Masa Cósmica, Reserva, Carga, Barrera, Retracción, A Defender |
| Ataque físico + reducción de daño | Enrosque |
| Ataque Especial + reducción de daño | Paz Mental |
| Ataque físico + Velocidad | Cambio de Marcha, Limpieza General |
| Acua Aro: regeneración | Arraigo, Recuperación, Relajo, Batido, Respiro, Sol Matinal, Luz Lunar, Recogearena, Descanso, Ovocuración, Auxilio |

**Síntesis** sigue siendo una mejora universal durante la partida: cada elección
añade +0,9 PS por segundo de regeneración sin ocupar un hueco de movimiento.
No se equipa ni se desbloquea como movimiento de una especie.

Cada efecto dual conserva la mitad de la potencia individual: +6,5% de Ataque
físico o Especial, +5% de Velocidad y +3,5 puntos porcentuales de reducción de
daño por acumulación inicial. Los apoyos regenerativos copian Acua Aro sin
curación instantánea: +1,6 PS por segundo por acumulación, hasta cuatro,
durante ocho segundos, con el mismo efecto visual de burbujas y la misma
reserva compartida. Los demás apoyos mantienen los tiempos, límites y mejoras
de su plantilla original.

Solo cambian el nombre, el tipo oficial y, para los duales, la combinación de
efectos existentes. No añaden precisión, evasión, críticos, costes de PS,
sueño, bonificaciones climáticas, efectos de equipo ni eliminación de estados,
trampas o Sustitutos. Barrera, Retracción y Auxilio no tienen aprendices en las
versiones seleccionadas; no se inventan movimientos para hacerlos disponibles.

### Evoluciones

Las evoluciones por nivel usan sus **niveles oficiales**: Charmander al 16,
Charmeleon al 36, Magikarp al 20, etc. Solo se ofrecen en la **pantalla de XP y
resultados al terminar la partida**, cuando esa recompensa hace subir el nivel
del Pokémon. No se activan al abrir el menú, Entrenamiento ni al preparar otra
partida. Si una recompensa supera varios niveles, se ofrece la evolución al
nivel alcanzado; también se pueden encadenar varias etapas si ya se cumplen sus
requisitos. Si el Pokémon ya había alcanzado el requisito, debe subir otro nivel
con la recompensa de una partida para recibir la oferta.

La animación clásica alterna las siluetas de ambas formas. Puedes pulsar
**Detener evolución**, `B` o `Esc`: el Pokémon conserva su forma y vuelve a
intentarlo **al subir otro nivel**, no al comenzar otra partida ni al recargar.
La opción **Animación suave** elimina los destellos y también se respetan las
preferencias de movimiento reducido del dispositivo.

Al evolucionar se **reemplaza la forma anterior**, conservando nivel, XP,
movimientos aprendidos, shiny, mejoras, naturaleza y posición de habilidad.
Los movimientos aprendidos antes de evolucionar siguen disponibles aunque no
estén en la lista de nivel de la nueva especie. Si ya tenías la especie de
destino, se conservan la XP y las mejoras máximas. Puedes volver a conseguir la
forma base en el gacha; empezará un entrenamiento nuevo en nivel 5.

El **gacha solo entrega formas base**, tanto normales como shiny, en todos sus
banners y tamaños de tirada. Las formas evolucionadas que ya tenías no se
eliminan. Las probabilidades mostradas reflejan los grupos disponibles; si falta
una rareza, se busca la más cercana, prefiriendo la superior para mantener la
garantía de Épica o superior. Evolucionar no quita el progreso de colección de
esa familia para el Amuleto Iris.

Por ahora se incluyen **317 evoluciones exclusivamente por nivel**. Las piedras,
intercambios, amistad y requisitos especiales (hora, sexo, estadísticas,
movimientos conocidos, versión o formas regionales) quedan pendientes; no se
inventan niveles para sustituirlos.

Esta primera versión usa los **103 movimientos de combate ya implementados**:
no incluye todos los ataques de los juegos oficiales y mantiene su adaptación al
combate de supervivencia. Sus especies compatibles y niveles proceden de
**Escarlata/Púrpura**, o del juego oficial más reciente disponible en los datos si
la especie no aparece allí, con el ajuste de apoyos de las formas base al
nivel 5 descrito arriba. La pantalla muestra el juego de origen. Las MT
aprendidas se pueden equipar si son compatibles. Si todavía no hay un ataque
implementado disponible (por ejemplo, Magikarp antes del nivel 15), se ofrece
**Forcejeo** como ataque de emergencia, no como movimiento de su lista oficial.

Las cuentas anteriores migran sin perder sus otros datos. Se conservan las
preferencias de ataques legales cuando es posible. Las antiguas compras de
huecos, ataques iniciales y vetos permanecen en el guardado, pero quedan
inactivas y no se reembolsan. Al fusionar cuentas/dispositivos se conserva la
**XP máxima por especie**, no se suman sesiones paralelas; el equipo se resuelve
por su fecha de edición.

### Datos y comprobaciones

La interfaz del juego oculta los botones de YouTube y apoyo, el diálogo de apoyo
y las peticiones de donación al terminar una run. Sus elementos se conservan
para compatibilidad con el motor; las páginas de apoyo independientes y los
créditos no cambian. `tools/patch-promotion-engine.cjs` quita además del motor
las consultas periódicas a GitHub y los temporizadores del botón de YouTube, del
aviso de vídeo y del carrusel del menú ocultos; se puede volver a ejecutar sin efectos.
`tools/patch-gpu-reset-engine.cjs` guarda en la memoria del sistema las texturas que el
motor genera una sola vez (terreno, árboles, rocas, cofres, minimapa y siluetas de golpe),
igual que el pueblo con sus edificios y árboles: si el navegador reinicia la GPU (por
ejemplo en Edge de Xbox), el escenario ya no desaparece durante el resto de la partida.

`js/training.js` contiene el modelo legible y la integración; `js/app.min.js`
conserva el motor existente con hooks puntuales. `tools/patch-responsive-engine.cjs` aplica al
motor los cambios de orientación, zona segura y escala de la interfaz; se puede volver a
ejecutar sin efectos.

`js/body-collision.js` mantiene los cuerpos enemigos fuera del cuerpo del jugador,
también durante la persecución rápida y las embestidas. Solo desplaza al enemigo:
no bloquea el movimiento del jugador ni cambia el alcance de sus ataques.
El daño por contacto, su intervalo y el retroceso siguen siendo los originales.
La separación se aplica después del movimiento y de la separación entre enemigos,
respeta los obstáculos y los jugadores vivos en cooperativo, y no modifica las
instantáneas de red ni el reciclaje de enemigos fuera de pantalla. El encuentro
especial de Arceus conserva su propio sistema de colisión.
`tools/patch-body-collision-engine.cjs` instala estos hooks de forma comprobada e
idempotente; ambos idiomas y la caché sin conexión cargan el módulo antes del motor.

`js/data/learnsets.js` incluye
los datos de movimientos, ascendencia y evoluciones sin consultas a PokeAPI
durante el juego. La revisión de origen y su licencia están en [CREDITS.md](CREDITS.md).

```sh
# Python 3; descarga CSV de una revisión fija de PokeAPI.
python tools/generate_learnsets.py
# O reutiliza los CSV descargados:
python tools/generate_learnsets.py --csv-dir /ruta/a/csv
# Node.js 18+, sin dependencias adicionales:
node --test tests/*.test.cjs
```

## Guardado en la nube y publicación

### Hosting this fork for friends (Firebase Spark, no billing)

This fork needs **your own Firebase project**. It does not use the original
developer's accounts, saves, room server, TURN service, or verified leaderboard.
The existing game supports up to four people in one co-op room. Everyone can
create an account; knowing the website URL is not an access restriction.

The selected project is `pokesurvivor-evolution` in `.firebaserc`. Change that
selection if you use another project. Its public Web app settings and default
Realtime Database URL are in `js/hosting-config.js`. Publishing is blocked if
these settings are missing or invalid.

1. In the [Firebase console](https://console.firebase.google.com/), create/select
   the project on **Spark**. Do not enable billing. Register a **Web app**.
   Analytics and Cloud Storage are not needed.
2. Under **Build > Authentication**, enable **Email/Password**. The existing game
   turns usernames into synthetic email addresses ending in `players.invalid`;
   players still enter a username and password, not a real email address.
   These accounts cannot receive email verification or password-reset mail.
   Use a new password rather than reusing one from another website.
3. Create **Cloud Firestore**, **Standard edition**, with the **default database**
   in production/locked mode. Create **Realtime Database** in locked mode.
   Choose nearby regions. Do not select test-mode rules; the repository contains
   the rules that the game needs.
4. If using another project, update `js/hosting-config.js` with its `firebaseConfig`
   object from **Project settings > General > Your apps**. Include `apiKey`,
   `authDomain`, `projectId`, `appId`, and the actual `databaseURL` from
   **Realtime Database > Data**. Other public Web app settings may be retained.
   The supported database is the project's default Realtime Database, not a
   separately named instance. Never put service-account JSON, private keys,
   passwords, or CLI tokens in this file.
5. In **Authentication > Settings > Authorized domains**, ensure your project's
   `PROJECT_ID.web.app` and `PROJECT_ID.firebaseapp.com` domains are authorized.
   Google sign-in is optional: enable its provider if you want to use that
   button; otherwise use username/password. Add `localhost` and `127.0.0.1`
   only if testing real cloud accounts locally.
6. Install **Node.js 22+**, then run from the repository directory:

   ```powershell
   npm ci
   npx firebase login
   npx firebase use pokesurvivor-evolution
   npm test
   npm run test:rules
   npm run deploy
   ```

   The rules tests also require **Java 21+** on PATH. The CLI deploys database
   rules/indexes and the static website, not a paid server or Cloud Functions.
   Complete any console/API setup the CLI explicitly requests. Hosting staging
   is repeated by the Hosting predeploy hook, so direct `firebase deploy`
   cannot bypass the client configuration check. Do not publish the repository
   root manually.
7. Share the **Hosting URL printed by the successful deploy**. Each person
   creates a new account, chooses a partner, and uses the town's **Friends**
   phone to add the others by nickname. Accept friend requests, then have one
   player invite both friends into the same room. All three share the town.
   Open the expedition room and have everyone, including the host, press
   **Ready up**; the host can start once all current members are connected
   and ready. Closing that room clears your readiness.

For updates, run `npm run deploy` again. `npm run preview` stages the site and
starts a localhost-only Hosting emulator; it uses your configured real backend
unless you explicitly use a local emulator configuration. To test Auth,
Firestore, and RTDB entirely locally, use a `demo-` project, a matching Web app
configuration with `emulator: true`, and the emulators on ports 9099/8080/9000.
The production staging command deliberately rejects `emulator: true`.

The staging script publishes only website files and required credits/licenses
to `dist`; it excludes `.git`, tests, tools, backend configuration, and the
original `CNAME`. Keep attribution and the noncommercial license. Standard
directory pages such as `/en/` are supported; there is no SPA catch-all rewrite
that turns missing scripts into HTML responses.

**Co-op connectivity:** direct WebRTC uses public STUN. If a browser cannot
connect directly, shared-town presence, ready-up acknowledgements, and
gameplay use the project's Realtime Database inboxes. Gameplay uses a lower
update rate on relay. The same readiness and launch checks apply to both
transports. Room membership and seats are published atomically, with
rules enforcing a maximum of four. The host releases departed lobby seats;
active games retain their existing reconnect behavior. Relay can add latency and consume significantly
more database bandwidth. There is no paid TURN dependency. WebRTC can disclose
players' IP addresses to one another; play with people you trust.

**Quota limits:** Spark does not bill for overages, but exhausted quotas can
interrupt hosting, signup, saves, or co-op. Watch Hosting transfer, Firestore
reads/writes, and Realtime Database downloads in the console, especially with
public signup or relay sessions. See
[Hosting quotas](https://firebase.google.com/docs/hosting/usage-quotas-pricing)
and [RTDB billing](https://firebase.google.com/docs/database/usage/billing).
This setup is not unlimited hosting or an anti-abuse service.

**Troubleshooting:** a setup message on startup means the client settings or
host do not match. Failed login may mean the Auth provider is disabled;
permission errors usually mean rules have not been deployed to the same
project. A successful local account is not proof of cloud connectivity. New
hosted accounts do not import original-site saves. If an old build persists,
reload first, then unregister its service worker in browser developer tools.
Do not clear site storage without a backup of any local saves.

**Acceptance before sharing:** use three separate signed-in browser sessions
to check invitations, joining, shared-town movement, everyone's readiness,
starting, ending a run, and persistence after reload. Also check a relay
session and connections from different home
networks. Automated local tests cannot prove your friends' remote connections.

The upstream feature description below is retained for context; the verified
public ranking is deliberately unavailable in this independently hosted fork.

- **Base de datos (Firebase):** cuentas con nombre + contraseña o Google, y la
  partida se sigue en cualquier ordenador.
  Las cuentas locales guardan sólo en el navegador; los invitados no guardan.
- **Jugar con amigos (hasta 4) y ranking:** con cuenta en la nube, menú
  **Amigos** (añadir por apodo, invitar a tu sala) y **Ranking** (tiempo
  aguantado: solo o grupo, de hoy a histórico, amigos, por Pokémon).
- Si se juega en dos ordenadores a la vez o sin conexión, las partidas se
  **fusionan**: las colecciones se unen (nunca se pierde un Pokémon ni un
  shiny), mejoras y estadísticas se quedan con el máximo, y monedas y
  compañero con la versión más reciente. Los cambios de otro ordenador llegan
  en directo.

## Licencia

Código bajo [PolyForm Noncommercial 1.0.0](LICENSE-NONCOMMERCIAL.md) desde el
14-10-2026: se puede usar, estudiar y modificar, pero **no con fines
comerciales** (ni vender el juego ni cobrar nada dentro de él). Las versiones
hasta el commit `b297089` se publicaron bajo MIT. Los sprites (CC BY-NC 4.0),
la fuente (OFL) y las marcas de Pokémon tienen sus propias condiciones: ver
[LICENSE](LICENSE) y [CREDITS.md](CREDITS.md). Proyecto de fan sin ánimo de
lucro.

**La única web oficial es [pokesurvivor.com](https://pokesurvivor.com).** El
juego es y será gratis: si alguien te pide pagar, no somos nosotros.

## Créditos y licencia

Sprites de [SpriteCollab](https://github.com/PMDCollab/SpriteCollab) bajo
**CC BY-NC 4.0** — uso **no comercial** y con atribución; la lista de artistas
está en [`CREDITS.md`](CREDITS.md). Pokémon es propiedad de Nintendo, Creatures
Inc. y GAME FREAK. Proyecto de fan sin ánimo de lucro.
