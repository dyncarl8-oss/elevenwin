import { Route, Switch, Redirect } from "wouter";
import ExperiencePage from "./pages/experience-page";
import NotFound from "./pages/not-found";
import "@fontsource/inter";

function App() {
  return (
    <Switch>
      <Route path="/">
        {() => <Redirect to="/experiences/dev-experience" />}
      </Route>
      <Route path="/experiences/:experienceId" component={ExperiencePage} />
      <Route path="/experiences/:experienceId/*" component={ExperiencePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default App;
