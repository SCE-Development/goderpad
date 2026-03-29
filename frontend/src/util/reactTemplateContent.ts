export const DEFAULT_CODE = `import React from 'react';

function App() {
  return (
    <div>
      <h1>Hello, World!</h1>
    </div>
  );
}
export default App;`;

export interface Template {
  name: string;
  description: string;
  code: string;
}

export const TEMPLATES: Template[] = [
  {
    name: 'standard',
    description: 'start with a clean react component',
    code: DEFAULT_CODE,
  },
  {
    name: 'gas station',
    description: 'the thanos problem',
    code: `/*
You are in SCE dev team and a member comes to you asking for help.
They are querying an API to get the information about a specific Costco
gas station, and their code doesn't work. Can you help them figure it out?
Definition of working:
1. The address, including the city is displayed
2. The regular and premium gas prices with a '$' is visible on the page
3. The full open hours for the entire week should be visible on the webpage.
*/

import { useState, useEffect } from "react";

function App() {
  // State for Costco data
  const [data, setData] = useState('');

  // fetch Costco data on page load
  useEffect(() => {
    const fetchCostcoData = async () => {
      const response = await fetch("https://sce.sjsu.edu/gas");
      const responseJsonData = await response.json();
      setData(responseJsonData);
    };

    fetchCostcoData();
  }, []);

  function renderCostcoData() {
    {/* how the heck do i get the gas station hours?! */ }
    for (const info of data.gasStationHours) {
      console.log(info)
    }
    if (!data) {
      return <p>Loading...</p>;
    }
    return (
      <div>
        <p id="address" > {data.address + data.city}</p>
        <p id="regular-gas-price">Regular gas price: $ {data.regularGasPrice}</p>
        <p id="premium-gas-price">Premium gas price: $ {data.premiumGasPrice}</p>
        <h4> Gas Station Open Hours: </h4>
        <pre id="gas-station-hours">
          Gas station hours go here, assuming i can get the above loop working
        </pre>
      </div>
    );
  }

  return (
    <>
      <div>
        <h3>Welcome to the SCE Costco Monitoring Page! </h3>
        {renderCostcoData()}
      </div>
    </>
  );
}

export default App;`,
  },
  {
    name: 'isbn problem',
    description: 'the standard sce interview',
    code: `/*
The SJSU website is down! Students need to find their textbook ISBNs.
Build a simple webpage with:
- An input box to enter an ISBN number
- A submit button
- When submitted, use the SCE ISBN API at https://sce.sjsu.edu/isbn/ to fetch and display:
  - Book title
  - Author
  - Link to the OpenLibrary page
  - Cover image
- If the ISBN isn't found, show a friendly "Book not found" message.

example ISBN requests with json responses look like:

https://sce.sjsu.edu/isbn/9780060244194
https://sce.sjsu.edu/isbn/9780060254926

you can look for example ISBN numbers with the below search tool:
https://openlibrary.org/
*/

import { useState } from 'react'

function App() {
  return (
    <>
      <h1>SCE ISBN Problem</h1>
    </>
  )
}

export default App;`, 
  }
  // Add your interview templates here
];
