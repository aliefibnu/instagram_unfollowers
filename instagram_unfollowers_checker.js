// Constants
const INSTAGRAM_HOSTNAME = "www.instagram.com";
const WHITELISTED_STORAGE_KEY = "iu_whitelisted-results";
const DEFAULT_TIME_BETWEEN_SEARCH_CYCLES = 1000; // 1s
const TIME_TO_WAIT_AFTER_FIVE_SEARCH_CYCLES = 10000; // 10s
const DEFAULT_TIME_BETWEEN_UNFOLLOWS = 4000; // 4s
const TIME_TO_WAIT_AFTER_FIVE_UNFOLLOWS = 300000; // 5min

// Utility Functions
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  return parts.length === 2 ? parts.pop().split(";").shift() : null;
}
function urlGenerator(cursor) {
  const userId = getCookie("ds_user_id");
  if (!userId) throw new Error("User ID cookie not found");
  const baseUrl = `https://www.instagram.com/graphql/query/?query_hash=3dec7e2c57367ef3da3d987d89f9dbc8&variables={"id":"${userId}","include_reel":"true","fetch_mutual":"false","first":"24"`;
  return cursor ? `${baseUrl},"after":"${cursor}"}` : `${baseUrl}}`;
}
function unfollowUserUrlGenerator(userId) {
  return `https://www.instagram.com/web/friendships/${userId}/unfollow/`;
}

// State
let state = {
  status: "initial", // initial, scanning, unfollowing
  percentage: 0,
  results: [], // List of followed accounts
  whitelistedResults: JSON.parse(
    localStorage.getItem(WHITELISTED_STORAGE_KEY) || "[]"
  ),
  unfollowLog: [],
};
let scanningPaused = false;

// State Management
function setState(updates) {
  state = { ...state, ...updates };
  if ("whitelistedResults" in updates) {
    localStorage.setItem(
      WHITELISTED_STORAGE_KEY,
      JSON.stringify(state.whitelistedResults)
    );
  }
}

// Scanning
async function scan() {
  if (state.status !== "initial") {
    console.error("Scan already in progress or completed");
    return;
  }
  setState({ status: "scanning", percentage: 0, results: [] });
  console.log("Starting scan...");

  let results = [];
  let cycleCount = 0;
  let url = urlGenerator();
  let hasNextPage = true;
  let totalCount = -1;
  let fetchedCount = 0;

  while (hasNextPage) {
    if (scanningPaused) {
      await sleep(1000);
      continue;
    }

    try {
      console.log(`Data url : ${url}`)
      const response = await fetch(url).then((res) => res.json());
      const data = response.data.user.edge_follow;
      if (totalCount === -1) totalCount = data.count;
      hasNextPage = data.page_info.has_next_page;
      url = urlGenerator(data.page_info.end_cursor);
      fetchedCount += data.edges.length;
      results.push(
        ...data.edges.map((edge) => ({
          id: edge.node.id,
          username: edge.node.username,
          full_name: edge.node.full_name,
          profile_pic_url: edge.node.profile_pic_url,
          is_verified: edge.node.is_verified,
          is_private: edge.node.is_private,
          follows_viewer: edge.node.follows_viewer,
        }))
      );
      setState({
        percentage: Math.floor((fetchedCount / totalCount) * 100),
        results,
      });
      console.log(
        `Progress: ${state.percentage}% (${fetchedCount}/${totalCount} users)`
      );
    } catch (error) {
      console.error("Scan error:", error);
    }

    await sleep(
      Math.floor(Math.random() * (DEFAULT_TIME_BETWEEN_SEARCH_CYCLES * 0.3)) +
        DEFAULT_TIME_BETWEEN_SEARCH_CYCLES
    );
    if (++cycleCount > 6) {
      cycleCount = 0;
      console.log(
        `Sleeping ${
          TIME_TO_WAIT_AFTER_FIVE_SEARCH_CYCLES / 1000
        } seconds to prevent temp blocked`
      );
      await sleep(TIME_TO_WAIT_AFTER_FIVE_SEARCH_CYCLES);
    }
  }

  // Output results
  console.log("Scan completed!");
  console.log("Followed Accounts:", results);
  console.log(
    "Non-Followers:",
    results.filter((u) => !u.follows_viewer)
  );
  console.log("Whitelisted Accounts:", state.whitelistedResults);
}

// Unfollowing
async function unfollow(userIds) {
  if (state.status !== "scanning") {
    console.error("Must complete scan before unfollowing");
    return;
  }
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    console.error("Provide an array of user IDs to unfollow");
    return;
  }

  const usersToUnfollow = state.results.filter((u) => userIds.includes(u.id));
  if (usersToUnfollow.length === 0) {
    console.error("No valid users found for unfollowing");
    return;
  }

  setState({ status: "unfollowing", percentage: 0, unfollowLog: [] });
  console.log(`Starting unfollow for ${usersToUnfollow.length} users...`);

  const csrftoken = getCookie("csrftoken");
  if (!csrftoken) {
    console.error("CSRF token not found");
    return;
  }

  let unfollowCount = 0;
  for (const user of usersToUnfollow) {
    unfollowCount++;
    const percentage = Math.floor(
      (unfollowCount / usersToUnfollow.length) * 100
    );
    try {
      await fetch(unfollowUserUrlGenerator(user.id), {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-csrftoken": csrftoken,
        },
        mode: "cors",
        credentials: "include",
      });
      setState({
        percentage,
        unfollowLog: [
          ...state.unfollowLog,
          { user, unfollowedSuccessfully: true },
        ],
      });
      console.log(
        `Unfollowed ${user.username} (${unfollowCount}/${usersToUnfollow.length})`
      );
    } catch (error) {
      console.error(`Failed to unfollow ${user.username}:`, error);
      setState({
        percentage,
        unfollowLog: [
          ...state.unfollowLog,
          { user, unfollowedSuccessfully: false },
        ],
      });
    }
    await sleep(
      Math.floor(Math.random() * (DEFAULT_TIME_BETWEEN_UNFOLLOWS * 0.2)) +
        DEFAULT_TIME_BETWEEN_UNFOLLOWS
    );
    if (unfollowCount % 5 === 0) {
      console.log(
        `Sleeping ${
          TIME_TO_WAIT_AFTER_FIVE_UNFOLLOWS / 60000
        } minutes to prevent temp blocked`
      );
      await sleep(TIME_TO_WAIT_AFTER_FIVE_UNFOLLOWS);
    }
  }

  console.log("Unfollow completed!");
  console.log("Unfollow Log:", state.unfollowLog);
}

// Whitelist Management
function toggleWhitelist(userId) {
  const user = state.results.find((u) => u.id === userId);
  if (!user) {
    console.error("User not found:", userId);
    return;
  }
  let newWhitelisted;
  if (state.whitelistedResults.some((u) => u.id === userId)) {
    newWhitelisted = state.whitelistedResults.filter((u) => u.id !== userId);
    console.log(`Removed ${user.username} from whitelist`);
  } else {
    newWhitelisted = [...state.whitelistedResults, user];
    console.log(`Added ${user.username} to whitelist`);
  }
  setState({ whitelistedResults: newWhitelisted });
}

// Pause Scanning
function pauseScan() {
  scanningPaused = !scanningPaused;
  console.log(scanningPaused ? "Scanning paused" : "Scanning resumed");
}

// Expose Functions to Console
window.InstagramUnfollowers = {
  scan,
  unfollow,
  toggleWhitelist,
  pauseScan,
  getState: () => state,
};

// Rewrite page
function rewritePage() {
  document.body.innerHTML = `
`;
}

console.log("Instagram Unfollowers Checker loaded. Available commands:");
console.log("- InstagramUnfollowers.scan(): Start scanning followed accounts");
console.log("- InstagramUnfollowers.unfollow([userIds]): Unfollow users by ID");
console.log(
  "- InstagramUnfollowers.toggleWhitelist(userId): Toggle whitelist status"
);
console.log("- InstagramUnfollowers.pauseScan(): Pause/resume scanning");
console.log("- InstagramUnfollowers.getState(): View current state");

// Check if running on Instagram
if (location.hostname === INSTAGRAM_HOSTNAME) {
  await scan();
} else {
  console.error("This script can only be used on www.instagram.com");
}
