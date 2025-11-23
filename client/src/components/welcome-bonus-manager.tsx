import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWhopUser } from "@/hooks/use-whop-user";
import WelcomeBonusButton from "@/components/welcome-bonus-button";

interface EligibilityData {
  eligible: boolean;
}

export default function WelcomeBonusManager() {
  const { user } = useWhopUser();
  const [claimed, setClaimed] = useState(false);

  const { data: eligibilityData } = useQuery<EligibilityData>({
    queryKey: [`/api/user/${user?.id}/welcome-bonus-eligible`],
    enabled: !!user?.id,
    retry: false,
  });

  if (!user?.id || !eligibilityData?.eligible || claimed) {
    return null;
  }

  return <WelcomeBonusButton userId={user.id} onClaimed={() => setClaimed(true)} />;
}
