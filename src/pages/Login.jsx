import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Loader2, Users, FileText, MapPin } from "lucide-react";
import { db, getOrgsForUser } from "@/api/db";
import { useAuth } from "@/lib/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [orgs, setOrgs] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [stats, setStats] = useState({ teams: 0, documents: 0, locations: 0 });
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState("");

  // Load all organizations on mount
  useEffect(() => {
    db.Organization.list()
      .then((list) => {
        setOrgs(list);
        if (list[0]) setSelectedOrgId(list[0].id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setInitializing(false));
  }, []);

  // When org changes, reload users and stats
  useEffect(() => {
    if (!selectedOrgId) return;
    setSelectedUserId("");

    Promise.all([
      db.OrgMember.filter({ org_id: selectedOrgId }),
      db.Team.filter({ org_id: selectedOrgId }),
      db.KBBDocument.filter({ org_id: selectedOrgId }),
      db.Location.filter({ org_id: selectedOrgId }),
    ]).then(async ([members, teams, docs, locs]) => {
      // Resolve member user records; fall back to all users if org has no members
      let validUsers = [];
      if (members.length > 0) {
        const memberUsers = await Promise.all(
          members.map((m) => db.User.get(m.user_id).catch(() => null))
        );
        validUsers = memberUsers.filter(Boolean);
      }
      if (validUsers.length === 0) {
        // No org_members configured yet — show all users as a convenience
        validUsers = await db.User.list();
      }
      setUsers(validUsers);
      if (validUsers[0]) setSelectedUserId(validUsers[0].id);
      setStats({
        teams: teams.length,
        documents: docs.filter((d) => !d.is_archived).length,
        locations: locs.length,
      });
    }).catch((e) => setError(e.message));
  }, [selectedOrgId]);

  const handleSignIn = async () => {
    if (!selectedUserId) return;
    setLoading(true);
    setError("");
    try {
      // Store selected org so OrgContext picks it up
      localStorage.setItem("kbb_current_org", selectedOrgId);
      await login(selectedUserId);
      navigate("/");
    } catch (e) {
      setError(e.message || "Sign in failed");
      setLoading(false);
    }
  };

  const selectedOrg = orgs.find((o) => o.id === selectedOrgId);
  const selectedUser = users.find((u) => u.id === selectedUserId);

  if (initializing) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* â”€â”€ Left branding panel â”€â”€ */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#1a2744] text-white flex-col justify-between p-12">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-white/20 flex items-center justify-center rounded-sm">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
          </div>

          {/* Tagline */}
          <p className="text-sm font-semibold tracking-widest text-blue-300 uppercase mb-4">
            KBB Pro &mdash; Document Library
          </p>
          <h1 className="text-5xl font-extrabold leading-tight mb-6">
            Sign in to<br />KBB Pro
          </h1>
          <p className="text-blue-200 text-base max-w-xs leading-relaxed">
            Choose a test user and sign in instantly. The correct organization context will be applied automatically.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { value: stats.teams, label: "Teams" },
            { value: stats.documents, label: "Documents" },
            { value: stats.locations, label: "Locations" },
          ].map(({ value, label }) => (
            <div key={label} className="border border-white/20 rounded-sm p-4">
              <div className="text-3xl font-bold">{value}</div>
              <div className="text-xs font-semibold tracking-widest text-blue-300 uppercase mt-1">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* â”€â”€ Right auth panel â”€â”€ */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 bg-primary flex items-center justify-center rounded-sm">
              <BookOpen className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">KBB Pro</span>
          </div>

          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-1">
            Authentication
          </p>
          <h2 className="text-3xl font-bold text-foreground mb-2">Sign In</h2>
          <p className="text-sm text-muted-foreground mb-8">
            Select a test user from the directory and create a session without entering a password.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="space-y-5">
            {/* Organization */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                Organization
              </label>
              <select
                className="w-full h-11 px-3 border border-border bg-background text-foreground text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                disabled={orgs.length === 0}
              >
                {orgs.length === 0 && <option>No organizations found</option>}
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>

            {/* Test User */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                Test User
              </label>
              <select
                className="w-full h-11 px-3 border border-border bg-background text-foreground text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                disabled={users.length === 0}
              >
                {users.length === 0 && <option>No members in this org</option>}
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.email}
                    {u.role === "admin" ? " (Admin)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Sign In button */}
            <button
              onClick={handleSignIn}
              disabled={!selectedUserId || loading}
              className="w-full h-12 bg-primary text-primary-foreground text-sm font-bold tracking-widest uppercase rounded-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
