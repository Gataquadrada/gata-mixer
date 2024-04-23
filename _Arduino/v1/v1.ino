
#include <LCD5110_Basic.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>


const int NUM_SLIDERS = 5;
const int analogInputs[NUM_SLIDERS] = {A0, A1, A2, A3, A4};
int analogSliderValues[NUM_SLIDERS];

const int SWITCH_PIN = 13;

String oldFromMixer = "";

LCD5110 myGLCD(8,9,10,12,11);

extern uint8_t SmallFont[];
extern uint8_t MediumNumbers[];

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);

  for (int i = 0; i < NUM_SLIDERS; i++) {
    pinMode(analogInputs[i], INPUT);
  }

  pinMode(SWITCH_PIN, INPUT);
  digitalWrite(SWITCH_PIN, HIGH);

  myGLCD.InitLCD();
  myGLCD.setFont(SmallFont);

  Serial.begin(9600); // initialize serial communication at 9600 bits per second
  // Serial.write("Hi!\n");
}

void loop() {
  String fromMixer = Serial.readString();
  
  if(fromMixer.length() == 0 and oldFromMixer.length() == 0) {
    myGLCD.clrScr();
    myGLCD.print("AWAITING", CENTER, 0);
    myGLCD.print("APP", CENTER, 8);
  } else {
    if(oldFromMixer != fromMixer) {
      myGLCD.clrScr();

      // Serial.println("fromMixer: " + fromMixer);
      int LCDLine = 0;

      String strs[20];
      int StringCount = 0;

      // Split the string into substrings
      if(fromMixer.length() > 0)
      {
        while (fromMixer.length() > 0)
        {
          int index = fromMixer.indexOf('|');
          if (index == -1) // No space found
          {
            strs[StringCount++] = fromMixer;
            break;
          }
          else
          {
            strs[StringCount++] = fromMixer.substring(0, index);
            fromMixer = fromMixer.substring(index+1);
          }
        }

        // Show the resulting substrings
        for (int i = 0; i < StringCount; i++)
        {
          myGLCD.print(strs[i], LEFT, LCDLine);
          LCDLine += 8;
        }
      }

      oldFromMixer = fromMixer;
    }
  }

  // myGLCD.print("MIC: ON", LEFT, 0);
  // myGLCD.print("GAME 100%", LEFT, 8);
  // myGLCD.print("GAME 100%", LEFT, 16);
  // myGLCD.print("GAME 100%", LEFT, 24);
  // myGLCD.print("GAME 100%", LEFT, 32);
  // myGLCD.print("GAME 100%", LEFT, 40);

  updateSliderValues();
  sendSliderValues();

  delay(10);
}

void updateSliderValues() {
  for (int i = 0; i < NUM_SLIDERS; i++) {
    analogSliderValues[i] = analogRead(analogInputs[i]);
  }
}

void sendSliderValues() {
  String builtString = String("");

  int switchState = digitalRead(SWITCH_PIN);
  if (switchState == HIGH) {
    builtString += "OFF|";
    digitalWrite(LED_BUILTIN, LOW);
  } else {
    builtString += "ON|";
    digitalWrite(LED_BUILTIN, HIGH);
  }

  for (int i = 0; i < NUM_SLIDERS; i++) {
    builtString += String((int)analogSliderValues[i]);

    if (i < NUM_SLIDERS - 1) {
      builtString += String("|");
    }
  }
  
  Serial.println(builtString);
}
