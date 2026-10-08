import type { GraphData } from "../viewer/types/graph";

/**
 * Skrivaren skriver inte ut — a troubleshooting guide, and the largest one here.
 *
 * ## Why this guide exists
 *
 * Every other example answers "am I entitled to something", and the answer is
 * an amount. This one answers "why is this not working", and the answer is an
 * **action**: change the toner, clear the queue, use another port. Same tool,
 * a different shape of question — which is the point of having it.
 *
 * It is also deliberately **big**. Twenty-four nodes, four branches, nothing
 * calculated: the case for a visual editor is weakest on a guide with three
 * steps and strongest on one nobody could hold in their head. A flow this size
 * is where you find out whether the canvas is a help or a wall.
 *
 * ## What it is not
 *
 * Not a decision. Nothing here is checked against a record, and no case is
 * opened — it is the answer someone would have got by asking a colleague who
 * happened to know. That is the honest claim for most guides, and it is worth
 * one example saying so plainly.
 */
export const troubleshootingExampleGraph: GraphData = {
  startNodeId: "start",
  nodes: [
    {
      id: "start",
      type: "question",
      position: {
        x: 0,
        y: 0,
      },
      data: {
        title: {
          sv: "Vad händer när du skriver ut?",
          en: "What happens when you print?",
        },
        variableName: "start",
        options: [
          {
            id: "nothing",
            label: {
              sv: "Ingenting alls",
              en: "Nothing at all",
            },
            value: "nothing",
          },
          {
            id: "error",
            label: {
              sv: "Ett felmeddelande",
              en: "An error message",
            },
            value: "error",
          },
          {
            id: "wrong",
            label: {
              sv: "Den skriver ut, men fel",
              en: "It prints, but wrong",
            },
            value: "wrong",
          },
          {
            id: "slow",
            label: {
              sv: "Den är väldigt långsam",
              en: "It is very slow",
            },
            value: "slow",
          },
        ],
        description: {
          sv: "Välj det som stämmer bäst. Vi frågar vidare därifrån.",
          en: "Pick whatever fits best. We ask on from there.",
        },
      },
    },
    {
      id: "power",
      type: "question",
      position: {
        x: 380,
        y: 0,
      },
      data: {
        title: {
          sv: "Lyser någon lampa på skrivaren?",
          en: "Is any light on the printer lit?",
        },
        variableName: "power",
        options: [
          {
            id: "green",
            label: {
              sv: "Ja, ett fast sken",
              en: "Yes, steady",
            },
            value: "green",
          },
          {
            id: "blink",
            label: {
              sv: "Ja, den blinkar",
              en: "Yes, blinking",
            },
            value: "blink",
          },
          {
            id: "none",
            label: {
              sv: "Nej, ingen lampa",
              en: "No light at all",
            },
            value: "none",
          },
        ],
      },
    },
    {
      id: "fix-power",
      type: "result",
      position: {
        x: 760,
        y: 0,
      },
      data: {
        title: {
          sv: "Kontrollera strömmen",
          en: "Check the power",
        },
        description: {
          sv: "Sitter sladden i både i skrivaren och i vägguttaget? Prova ett uttag du vet fungerar.",
          en: "Is the cable in both the printer and the wall? Try a socket you know works.",
        },
      },
    },
    {
      id: "connection",
      type: "question",
      position: {
        x: 760,
        y: 370,
      },
      data: {
        title: {
          sv: "Hur är skrivaren ansluten?",
          en: "How is the printer connected?",
        },
        variableName: "connection",
        options: [
          {
            id: "usb",
            label: {
              sv: "Med sladd till datorn",
              en: "By cable to the computer",
            },
            value: "usb",
          },
          {
            id: "wifi",
            label: {
              sv: "Trådlöst",
              en: "Wirelessly",
            },
            value: "wifi",
          },
          {
            id: "unknown",
            label: {
              sv: "Vet inte",
              en: "I don't know",
            },
            value: "unknown",
          },
        ],
      },
    },
    {
      id: "fix-usb",
      type: "result",
      position: {
        x: 1900,
        y: 0.0,
      },
      data: {
        title: {
          sv: "Prova en annan port",
          en: "Try another port",
        },
        description: {
          sv: "Dra ur sladden och sätt i den i en annan USB-port. Undvik hubb eller dockningsstation första gången.",
          en: "Unplug the cable and use another USB port. Avoid a hub or a docking station the first time.",
        },
      },
    },
    {
      id: "network",
      type: "question",
      position: {
        x: 1900,
        y: 400,
      },
      data: {
        title: {
          sv: "Syns skrivaren i listan över skrivare?",
          en: "Does the printer appear in the list of printers?",
        },
        variableName: "network",
        options: [
          {
            id: "yes",
            label: {
              sv: "Ja",
              en: "Yes",
            },
            value: "yes",
          },
          {
            id: "no",
            label: {
              sv: "Nej",
              en: "No",
            },
            value: "no",
          },
        ],
      },
    },
    {
      id: "fix-queue",
      type: "result",
      position: {
        x: 2280,
        y: 0.0,
      },
      data: {
        title: {
          sv: "Töm utskriftskön",
          en: "Clear the print queue",
        },
        description: {
          sv: "En utskrift som fastnat stoppar alla efter den. Öppna kön, ta bort allt, och skriv ut en sida igen.",
          en: "One stuck job stops every job behind it. Open the queue, remove everything, and print one page again.",
        },
      },
    },
    {
      id: "fix-network",
      type: "result",
      position: {
        x: 2280,
        y: 370,
      },
      data: {
        title: {
          sv: "Kontrollera nätverket",
          en: "Check the network",
        },
        description: {
          sv: "Är skrivaren på samma nät som datorn? Skriv ut skrivarens nätverksrapport från dess egen meny och jämför.",
          en: "Is the printer on the same network as the computer? Print its network report from its own menu and compare.",
        },
      },
    },
    {
      id: "fix-blink",
      type: "result",
      position: {
        x: 760,
        y: 830,
      },
      data: {
        title: {
          sv: "Läs vad blinkningen betyder",
          en: "Read what the blinking means",
        },
        description: {
          sv: "En blinkande lampa är ett meddelande. Skrivarens display eller manual säger vilket — oftast papper, toner eller lucka.",
          en: "A blinking light is a message. The printer's display or manual says which — usually paper, toner or a door.",
        },
      },
    },
    {
      id: "message",
      type: "question",
      position: {
        x: 380,
        y: 470,
      },
      data: {
        title: {
          sv: "Vad står det?",
          en: "What does it say?",
        },
        variableName: "message",
        options: [
          {
            id: "jam",
            label: {
              sv: "Papperstrassel",
              en: "Paper jam",
            },
            value: "jam",
          },
          {
            id: "toner",
            label: {
              sv: "Tonern är slut",
              en: "Out of toner",
            },
            value: "toner",
          },
          {
            id: "offline",
            label: {
              sv: "Offline",
              en: "Offline",
            },
            value: "offline",
          },
          {
            id: "driver",
            label: {
              sv: "Något om drivrutin",
              en: "Something about a driver",
            },
            value: "driver",
          },
        ],
      },
    },
    {
      id: "fix-jam",
      type: "result",
      position: {
        x: 760,
        y: 1280,
      },
      data: {
        title: {
          sv: "Ta ut pappret hela vägen",
          en: "Pull the paper all the way out",
        },
        description: {
          sv: "Öppna luckorna i tur och ordning och dra pappret i matningsriktningen. En kvarglömd bit räknas fortfarande som trassel.",
          en: "Open each door in turn and pull the paper the way it was travelling. A scrap left behind still counts as a jam.",
        },
      },
    },
    {
      id: "fix-toner",
      type: "result",
      position: {
        x: 760,
        y: 1680,
      },
      data: {
        title: {
          sv: "Byt tonerkassetten",
          en: "Change the toner cartridge",
        },
        description: {
          sv: "Skaka den gamla kassetten i sidled först — det räcker ofta för några hundra sidor till medan en ny beställs.",
          en: "Shake the old cartridge sideways first — that is often a few hundred pages more while a new one is ordered.",
        },
      },
    },
    {
      id: "fix-offline",
      type: "result",
      position: {
        x: 1140,
        y: 6.0,
      },
      data: {
        title: {
          sv: "Sätt skrivaren i läge online",
          en: "Put the printer back online",
        },
        description: {
          sv: "Offline är ett läge, inte ett fel. Högerklicka skrivaren i listan och avmarkera Använd skrivaren offline.",
          en: "Offline is a mode, not a fault. Right-click the printer in the list and clear Use printer offline.",
        },
      },
    },
    {
      id: "fix-driver",
      type: "result",
      position: {
        x: 1140,
        y: 400,
      },
      data: {
        title: {
          sv: "Installera om drivrutinen",
          en: "Reinstall the driver",
        },
        description: {
          sv: "Ta bort skrivaren ur listan helt, starta om datorn, och lägg till den igen. Halvt borttagen är värre än kvar.",
          en: "Remove the printer from the list entirely, restart the computer, and add it again. Half-removed is worse than left alone.",
        },
      },
    },
    {
      id: "looks",
      type: "question",
      position: {
        x: 380,
        y: 960,
      },
      data: {
        title: {
          sv: "Vad är det för fel på utskriften?",
          en: "What is wrong with the printout?",
        },
        variableName: "looks",
        options: [
          {
            id: "streaks",
            label: {
              sv: "Streck eller fläckar",
              en: "Streaks or smudges",
            },
            value: "streaks",
          },
          {
            id: "faded",
            label: {
              sv: "Blekt",
              en: "Faded",
            },
            value: "faded",
          },
          {
            id: "skew",
            label: {
              sv: "Snett eller beskuret",
              en: "Crooked or cut off",
            },
            value: "skew",
          },
          {
            id: "garbled",
            label: {
              sv: "Fel tecken",
              en: "Wrong characters",
            },
            value: "garbled",
          },
        ],
      },
    },
    {
      id: "fix-streaks",
      type: "result",
      position: {
        x: 1140,
        y: 800,
      },
      data: {
        title: {
          sv: "Rengör pappersbanan",
          en: "Clean the paper path",
        },
        description: {
          sv: "Streck på samma ställe varje sida betyder något i vägen. Kör skrivarens rengöringsprogram, och torka valsarna med en fuktad trasa.",
          en: "Streaks in the same place on every page mean something is in the way. Run the printer's cleaning routine, and wipe the rollers with a damp cloth.",
        },
      },
    },
    {
      id: "fix-faded",
      type: "result",
      position: {
        x: 1140,
        y: 1220,
      },
      data: {
        title: {
          sv: "Tonern är nästan slut",
          en: "The toner is nearly out",
        },
        description: {
          sv: "Blekt över hela sidan är nästan alltid toner. Skaka kassetten, och beställ en ny innan den tar slut mitt i något.",
          en: "Faded across the whole page is nearly always toner. Shake the cartridge, and order a new one before it runs out in the middle of something.",
        },
      },
    },
    {
      id: "fix-skew",
      type: "result",
      position: {
        x: 1140,
        y: 1620,
      },
      data: {
        title: {
          sv: "Justera pappersfacket",
          en: "Adjust the paper tray",
        },
        description: {
          sv: "Stöden i facket ska ligga an mot bunten utan att böja den. För löst ger snett, för hårt ger trassel.",
          en: "The guides in the tray should touch the stack without bending it. Too loose prints crooked, too tight jams.",
        },
      },
    },
    {
      id: "fix-garbled",
      type: "result",
      position: {
        x: 1520,
        y: 156.0,
      },
      data: {
        title: {
          sv: "Fel drivrutin för modellen",
          en: "The wrong driver for the model",
        },
        description: {
          sv: "Rappakalja är nästan alltid fel språk mellan dator och skrivare. Kontrollera att drivrutinen gäller just den här modellen.",
          en: "Gibberish is nearly always the wrong language between computer and printer. Check that the driver is for this exact model.",
        },
      },
    },
    {
      id: "slowness",
      type: "question",
      position: {
        x: 380,
        y: 1530,
      },
      data: {
        title: {
          sv: "Är den långsam på allt, eller bara ibland?",
          en: "Is it slow with everything, or only sometimes?",
        },
        variableName: "slowness",
        options: [
          {
            id: "always",
            label: {
              sv: "På allt",
              en: "With everything",
            },
            value: "always",
          },
          {
            id: "images",
            label: {
              sv: "Bara sidor med bilder",
              en: "Only pages with images",
            },
            value: "images",
          },
          {
            id: "first",
            label: {
              sv: "Bara första sidan",
              en: "Only the first page",
            },
            value: "first",
          },
        ],
      },
    },
    {
      id: "fix-quality",
      type: "result",
      position: {
        x: 1520,
        y: 580,
      },
      data: {
        title: {
          sv: "Sänk utskriftskvaliteten",
          en: "Lower the print quality",
        },
        description: {
          sv: "Högsta kvalitet tar flera gånger så lång tid. Standard räcker för allt utom det som ska ut ur huset.",
          en: "The highest quality takes several times as long. Standard is enough for everything that does not leave the building.",
        },
      },
    },
    {
      id: "fix-images",
      type: "result",
      position: {
        x: 1520,
        y: 980,
      },
      data: {
        title: {
          sv: "Skrivaren har för lite minne",
          en: "The printer is short of memory",
        },
        description: {
          sv: "En sida med bilder byggs i skrivaren innan den skrivs ut. Skriv ut som bild i stället för vektor, eller lägg till minne.",
          en: "A page with images is built inside the printer before it prints. Print as an image rather than vector, or add memory.",
        },
      },
    },
    {
      id: "fix-warmup",
      type: "result",
      position: {
        x: 1520,
        y: 1380,
      },
      data: {
        title: {
          sv: "Den värmer upp",
          en: "It is warming up",
        },
        description: {
          sv: "Första sidan efter en paus tar längre tid av konstruktion. Stäng av strömsparläget om väntan stör mer än strömmen kostar.",
          en: "The first page after a pause takes longer by design. Turn off power saving if the wait costs more than the electricity.",
        },
      },
    },
    {
      id: "fix-unknown",
      type: "result",
      position: {
        x: 1900,
        y: 820,
      },
      data: {
        title: {
          sv: "Ta reda på hur den är ansluten",
          en: "Find out how it is connected",
        },
        description: {
          sv: "Titta bakom skrivaren: en tjock sladd till datorn är USB, en tunn med klick är nätverk, ingen alls är trådlöst.",
          en: "Look behind the printer: a thick cable to the computer is USB, a thin one that clicks is network, none at all is wireless.",
        },
      },
    },
  ],
  connections: [
    {
      id: "c0",
      from: {
        nodeId: "start",
        portId: "nothing",
      },
      to: {
        nodeId: "power",
        portId: "input",
      },
    },
    {
      id: "c1",
      from: {
        nodeId: "start",
        portId: "error",
      },
      to: {
        nodeId: "message",
        portId: "input",
      },
    },
    {
      id: "c2",
      from: {
        nodeId: "start",
        portId: "wrong",
      },
      to: {
        nodeId: "looks",
        portId: "input",
      },
    },
    {
      id: "c3",
      from: {
        nodeId: "start",
        portId: "slow",
      },
      to: {
        nodeId: "slowness",
        portId: "input",
      },
    },
    {
      id: "c4",
      from: {
        nodeId: "power",
        portId: "none",
      },
      to: {
        nodeId: "fix-power",
        portId: "input",
      },
    },
    {
      id: "c5",
      from: {
        nodeId: "power",
        portId: "green",
      },
      to: {
        nodeId: "connection",
        portId: "input",
      },
    },
    {
      id: "c6",
      from: {
        nodeId: "power",
        portId: "blink",
      },
      to: {
        nodeId: "fix-blink",
        portId: "input",
      },
    },
    {
      id: "c7",
      from: {
        nodeId: "connection",
        portId: "usb",
      },
      to: {
        nodeId: "fix-usb",
        portId: "input",
      },
    },
    {
      id: "c8",
      from: {
        nodeId: "connection",
        portId: "wifi",
      },
      to: {
        nodeId: "network",
        portId: "input",
      },
    },
    {
      id: "c9",
      from: {
        nodeId: "connection",
        portId: "unknown",
      },
      to: {
        nodeId: "fix-unknown",
        portId: "input",
      },
    },
    {
      id: "c10",
      from: {
        nodeId: "network",
        portId: "yes",
      },
      to: {
        nodeId: "fix-queue",
        portId: "input",
      },
    },
    {
      id: "c11",
      from: {
        nodeId: "network",
        portId: "no",
      },
      to: {
        nodeId: "fix-network",
        portId: "input",
      },
    },
    {
      id: "c12",
      from: {
        nodeId: "message",
        portId: "jam",
      },
      to: {
        nodeId: "fix-jam",
        portId: "input",
      },
    },
    {
      id: "c13",
      from: {
        nodeId: "message",
        portId: "toner",
      },
      to: {
        nodeId: "fix-toner",
        portId: "input",
      },
    },
    {
      id: "c14",
      from: {
        nodeId: "message",
        portId: "offline",
      },
      to: {
        nodeId: "fix-offline",
        portId: "input",
      },
    },
    {
      id: "c15",
      from: {
        nodeId: "message",
        portId: "driver",
      },
      to: {
        nodeId: "fix-driver",
        portId: "input",
      },
    },
    {
      id: "c16",
      from: {
        nodeId: "looks",
        portId: "streaks",
      },
      to: {
        nodeId: "fix-streaks",
        portId: "input",
      },
    },
    {
      id: "c17",
      from: {
        nodeId: "looks",
        portId: "faded",
      },
      to: {
        nodeId: "fix-faded",
        portId: "input",
      },
    },
    {
      id: "c18",
      from: {
        nodeId: "looks",
        portId: "skew",
      },
      to: {
        nodeId: "fix-skew",
        portId: "input",
      },
    },
    {
      id: "c19",
      from: {
        nodeId: "looks",
        portId: "garbled",
      },
      to: {
        nodeId: "fix-garbled",
        portId: "input",
      },
    },
    {
      id: "c20",
      from: {
        nodeId: "slowness",
        portId: "always",
      },
      to: {
        nodeId: "fix-quality",
        portId: "input",
      },
    },
    {
      id: "c21",
      from: {
        nodeId: "slowness",
        portId: "images",
      },
      to: {
        nodeId: "fix-images",
        portId: "input",
      },
    },
    {
      id: "c22",
      from: {
        nodeId: "slowness",
        portId: "first",
      },
      to: {
        nodeId: "fix-warmup",
        portId: "input",
      },
    },
  ],
  settings: {
    sourceLocale: "sv",
    locales: ["sv", "en"],
  },
} as unknown as GraphData;
