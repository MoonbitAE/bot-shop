import React, { useState } from 'react';
import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  gql,
  useLazyQuery,
  useMutation,
  createHttpLink,
  ApolloLink,
} from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import botDetector from './botDetection';

// Create the HTTP link for GraphQL
const httpLink = createHttpLink({
  uri: '/graphql',
});

// Create a bot-specific HTTP link
const botHttpLink = createHttpLink({
  uri: '/bot/graphql',
});

// Add bot detection information to the headers
const authLink = setContext((_, { headers }) => {
  // Get current bot confidence score
  const botConfidenceScore = botDetector.getConfidenceScore();
  const isBot = botDetector.isLikelyBot();
  
  console.log(`Bot detection: score=${botConfidenceScore.toFixed(2)}, isBot=${isBot}`);
  
  // Return the headers with bot score information
  return {
    headers: {
      ...headers,
      'X-Bot-Confidence': botConfidenceScore.toFixed(2),
      'X-User-Agent-Type': isBot ? 'bot' : 'human',
      'X-Bot-Intelligence': botDetector.getIntelligenceLevel(),
    }
  };
});

// Configure Apollo Client with conditional link selection based on bot detection
const client = new ApolloClient({
  link: authLink.concat(
    ApolloLink.split(
      // Test function to determine which link to use
      () => botDetector.isLikelyBot(),
      // True: use bot link
      botHttpLink,
      // False: use regular link
      httpLink
    )
  ),
  cache: new InMemoryCache(),
});

const SEARCH_FLIGHTS = gql`
  query searchFlights($origin: String!, $destination: String!, $dates: [String!]!) {
    searchFlights(origin: $origin, destination: $destination, dates: $dates) {
      id
      origin
      destination
      departureTime
      arrivalTime
      price
    }
  }
`;

const BOOK_FLIGHT = gql`
  mutation bookFlight($passengerDetails: String!, $payment: String!, $flightId: Float!) {
    bookFlight(passengerDetails: $passengerDetails, payment: $payment, flightId: $flightId) {
      bookingId
      flight {
        id
        origin
        destination
        departureTime
        arrivalTime
        price
      }
    }
  }
`;

function SearchPage({ onSearchResults }) {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [dates, setDates] = useState('');
  const [search, { loading, data, error }] = useLazyQuery(SEARCH_FLIGHTS, {
    variables: { origin, destination, dates: dates.split(',') },
    onCompleted: (data) => onSearchResults(data.searchFlights),
  });

  return (
    <div className="card">
      <h1>Flight Search</h1>
      <div className="flex flex-col flex-md-row gap-4">
        <input
          placeholder="Origin"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
        />
        <input
          placeholder="Destination"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
        />
      </div>
      <input
        placeholder="Dates (comma-separated)"
        value={dates}
        onChange={(e) => setDates(e.target.value)}
      />
      <button 
        className="btn btn-full btn-md-auto"
        onClick={() => search()}>
        Search Flights
      </button>
      {loading && <p>Loading flights...</p>}
      {error && <p className="text-red">Error: {error.message}</p>}
    </div>
  );
}

function FlightResults({ flights, onSelectFlight }) {
  if (!flights) return null;
  return (
    <div className="card">
      <h2>Flight Results</h2>
      <div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Origin</th>
              <th>Dest</th>
              <th>Depart</th>
              <th>Arrive</th>
              <th>Price</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {flights.map((f) => (
              <tr key={f.id}>
                <td>{f.id}</td>
                <td>{f.origin}</td>
                <td>{f.destination}</td>
                <td>{f.departureTime}</td>
                <td>{f.arrivalTime}</td>
                <td>${f.price}</td>
                <td className="text-right">
                  <button 
                    className="btn btn-green"
                    onClick={() => onSelectFlight(f)}>
                    Select
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BookingPage({ flight, onBookingComplete }) {
  const [passenger, setPassenger] = useState('');
  const [payment, setPayment] = useState('');
  const [bookFlight, { data, loading, error }] = useMutation(BOOK_FLIGHT, {
    variables: { passengerDetails: passenger, payment, flightId: flight.id },
    onCompleted: (data) => onBookingComplete(data.bookFlight),
  });

  if (data) {
    return (
      <div className="card">
        <h2 className="text-green">Booking Confirmed</h2>
        <div className="bg-green-light border-green rounded p-4 mb-4">
          <p className="text-lg font-bold">Booking ID: {data.bookFlight.bookingId}</p>
        </div>
        <div className="bg-gray-light rounded p-4">
          <p className="mb-2">
            <span className="font-medium">Flight:</span> {data.bookFlight.flight.origin} → {data.bookFlight.flight.destination}
          </p>
          <p className="mb-2">
            <span className="font-medium">Departure:</span> {data.bookFlight.flight.departureTime}
          </p>
          <p className="mb-2">
            <span className="font-medium">Arrival:</span> {data.bookFlight.flight.arrivalTime}
          </p>
          <p className="text-lg font-bold text-blue">
            Price: ${data.bookFlight.flight.price}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Passenger Information</h2>
      <div>
        <label htmlFor="passenger">Passenger Details</label>
        <input
          id="passenger"
          placeholder="Full Name"
          value={passenger}
          onChange={(e) => setPassenger(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="payment">Payment Details</label>
        <input
          id="payment"
          placeholder="Card Number"
          value={payment}
          onChange={(e) => setPayment(e.target.value)}
        />
      </div>
      <button 
        className="btn btn-full btn-md-auto"
        onClick={() => bookFlight()}>
        Book Flight
      </button>
      {loading && <p>Processing booking...</p>}
      {error && <p className="text-red">Error: {error.message}</p>}
    </div>
  );
}

function App() {
  const [step, setStep] = useState('search');
  const [flights, setFlights] = useState(null);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [booking, setBooking] = useState(null);
  const [botInfo, setBotInfo] = useState({
    isBot: false,
    score: 0.5,
    adaptedView: false,
    intelligence: 'L0'
  });

  // Periodically update the bot detection status (every 5 seconds)
  React.useEffect(() => {
    const checkBotStatus = () => {
      const score = botDetector.getConfidenceScore();
      const isBot = botDetector.isLikelyBot();
      const intelligence = botDetector.getIntelligenceLevel();
      
      setBotInfo(prev => ({
        ...prev,
        isBot,
        score,
        // Only mark as adapted the first time we detect a bot
        adaptedView: prev.adaptedView || isBot,
        intelligence
      }));
    };
    
    // Initial check
    checkBotStatus();
    
    // Set up interval for periodic checks
    const intervalId = setInterval(checkBotStatus, 5000);
    
    // Cleanup
    return () => clearInterval(intervalId);
  }, []);

  // Optionally display debugging info (remove in production)
  const BotDebugInfo = () => (
    <div className={`p-4 rounded mb-4 ${botInfo.isBot ? 'bg-red-light border-red' : 'bg-gray-light'}`} 
         style={{ fontSize: '14px' }}>
      <p><strong>Bot Detection Status:</strong></p>
      <p>Confidence Score: <span className={botInfo.score > 0.5 ? 'text-red font-bold' : ''}>{botInfo.score.toFixed(2)}</span></p>
      <p>Detected as: <span className={botInfo.isBot ? 'text-red font-bold' : ''}>{botInfo.isBot ? 'BOT' : 'Human'}</span></p>
      <p>View Adapted: {botInfo.adaptedView ? 'Yes' : 'No'}</p>
      <p>Intelligence Level: <span className={botInfo.intelligence === 'L2' ? 'text-red font-bold' : ''}>{botInfo.intelligence}</span></p>
      <p>Using API: {botInfo.isBot ? '/bot/graphql' : '/graphql'}</p>
    </div>
  );

  return (
    <ApolloProvider client={client}>
      <div>
        <header className="header">
          <div className="container">
            <h1 className="text-xl font-bold">AI-cessible Airline Shopping</h1>
          </div>
        </header>
        
        <main className="main">
          <div className="container">
            {/* Show detection info (for demo purposes) */}
            <BotDebugInfo />
            
            {step === 'search' && (
              <SearchPage
                onSearchResults={(res) => {
                  setFlights(res);
                  setStep('results');
                }}
              />
            )}
            {step === 'results' && (
              <FlightResults
                flights={flights}
                onSelectFlight={(f) => {
                  setSelectedFlight(f);
                  setStep('book');
                }}
              />
            )}
            {step === 'book' && selectedFlight && !booking && (
              <BookingPage
                flight={selectedFlight}
                onBookingComplete={(conf) => {
                  setBooking(conf);
                  setStep('confirmation');
                }}
              />
            )}
            {step === 'confirmation' && booking && (
              <div className="card text-center">
                <div className="text-green mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                </div>
                <h2 className="text-2xl mb-4">Booking Successful!</h2>
                <p className="text-xl mb-8">Your booking ID: {booking.bookingId}</p>
                <button 
                  className="btn"
                  onClick={() => setStep('search')}>
                  Book Another Flight
                </button>
              </div>
            )}
          </div>
        </main>
        
        <footer className="footer">
          <div className="container">
            <p>AI-cessible Airline Shopping Demo &copy; {new Date().getFullYear()}</p>
          </div>
        </footer>
      </div>
    </ApolloProvider>
  );
}

export default App;